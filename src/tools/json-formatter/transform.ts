import type { SettingField, TransformError, TransformResult, ToolSettings } from "../../platform/types";

export const jsonDefaults = {
  indentMode: "2", // "2" | "4" | "tab" | "minify"
  sortKeys: false,
  ensureAscii: false,
  unescape: true,
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
    key: "unescape",
    label: "去转义",
    hint: '输入是转义的 JSON 文档（如 "{\\"a\\":1}"）时，先反转义再格式化',
    default: jsonDefaults.unescape,
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

  // 去转义：输入是转义的 JSON 文档（整体被引号包裹）时，反转义出内层再格式化。
  // 文档形态（{ [ 开头）直接剥；字符串字面量仅在剥出来仍是字符串（多重转义
  // 中间层）时继续剥——"123"、"hello" 这类标量字符串不提升。限深 5 层防打爆
  if (s.unescape ?? jsonDefaults.unescape) {
    for (let depth = 0; typeof parsed === "string" && depth < 5; depth++) {
      const inner = parsed.trim();
      const docLike = inner.startsWith("{") || inner.startsWith("[");
      const quoted = inner.startsWith('"') && inner.endsWith('"');
      if (!docLike && !quoted) break;
      let next: unknown;
      try {
        next = JSON.parse(inner);
      } catch {
        break;
      }
      if (docLike || typeof next === "string") {
        parsed = next;
      } else {
        break;
      }
    }
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

  const lineMatch = /line (\d+)/i.exec(message);
  if (lineMatch) return { message, line: Number(lineMatch[1]) };

  const pos = errorPosition(message, input);
  if (pos === undefined) return { message };
  return { message, line: input.slice(0, Math.min(pos, input.length)).split("\n").length };
}

/**
 * 从报错文案还原出错位置（字符偏移）。
 * 旧版 V8 直接给 `at position N`；新版 V8（含 Windows WebView2）只给错误点
 * **前后各 10 字符**的原文片段，且用引号包住：
 * `Unexpected token ',', ..."b": ,\n..."... is not valid JSON`。
 * 片段是原文的切片，故可 indexOf 反查窗口起点；窗口未贴开头时起点即 pos-10，
 * 贴着开头时窗口起点为 0、片段长度即 pos+10。JSC（macOS WKWebView）不给位置，放弃行号。
 */
export function errorPosition(message: string, input: string): number | undefined {
  const posMatch = /position (\d+)/i.exec(message);
  if (posMatch) return Number(posMatch[1]);

  const raw = /\.\.\.([\s\S]*)\.\.\. is not valid JSON\s*$/.exec(message)?.[1];
  if (!raw) return undefined;
  const snippet = raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"') ? raw.slice(1, -1) : raw;
  const idx = input.indexOf(snippet);
  if (idx < 0) return undefined;
  return idx === 0 ? Math.max(0, snippet.length - 10) : idx + 10;
}
