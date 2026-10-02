import type { SettingField, TransformError, TransformResult, ToolSettings } from "../../platform/types";

export const jsonDefaults = {
  indentMode: "2", // "2" | "4" | "tab" | "minify"
  sortKeys: false,
  ensureAscii: false,
};

export const jsonSchema: SettingField[] = [
  {
    type: "select",
    key: "indentMode",
    label: "缩进",
    default: jsonDefaults.indentMode,
    options: [
      { value: "2", label: "2 空格" },
      { value: "4", label: "4 空格" },
      { value: "tab", label: "Tab" },
      { value: "minify", label: "压缩为一行" },
    ],
  },
  {
    type: "toggle",
    key: "sortKeys",
    label: "键排序",
    hint: "递归按字典序排序对象键，数组元素顺序不变",
    default: jsonDefaults.sortKeys,
  },
  {
    type: "toggle",
    key: "ensureAscii",
    label: "转义非 ASCII",
    hint: "把中文等字符输出为 \\uXXXX 转义序列",
    default: jsonDefaults.ensureAscii,
  },
];

/** 纯函数：格式化 / 压缩 / 校验 JSON。可被 Worker 与单测直接调用。 */
export function formatJson(input: string, s: ToolSettings): TransformResult {
  const trimmed = input.trim();
  if (!trimmed) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return { error: jsonError(err, trimmed) };
  }

  if (s.sortKeys) parsed = sortDeep(parsed);

  const indent =
    s.indentMode === "minify" ? undefined : s.indentMode === "tab" ? "\t" : Number(s.indentMode) || 2;

  let output = JSON.stringify(parsed, null, indent) ?? "";

  if (s.ensureAscii) {
    output = output.replace(/[\u0080-\uffff]/g, (ch) =>
      `\\u${ch.charCodeAt(0).toString(16).padStart(4, "0")}`,
    );
  }

  return { output };
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return Object.fromEntries(entries.map(([k, v]) => [k, sortDeep(v)]));
  }
  return value;
}

/** 从 JSON.parse 的报错里尽量还原行号（V8: position N；SpiderMonkey/JSC: line N） */
function jsonError(err: unknown, input: string): TransformError {
  const message = err instanceof Error ? err.message : String(err);
  let line: number | undefined;

  const lineMatch = /line (\d+)/i.exec(message);
  const posMatch = /position (\d+)/i.exec(message);
  if (lineMatch) {
    line = Number(lineMatch[1]);
  } else if (posMatch) {
    const pos = Math.min(Number(posMatch[1]), input.length);
    line = input.slice(0, pos).split("\n").length;
  }
  return { message, line };
}
