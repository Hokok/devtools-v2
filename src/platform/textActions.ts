/**
 * 通用文本操作（见 CONTEXT.md）：对任意文本做与具体工具无关的洗文本动作。
 * 纯函数、零依赖——可单测，也可被任何工具复用（不碰 DOM、不碰 store）。
 *
 * 行语义：统一按 LF 处理（CRLF 视作行尾）；保留原文是否以换行结尾。
 */

export interface TextAction {
  id: string;
  label: string;
  apply: (text: string) => string;
}

function splitLines(text: string): { lines: string[]; trailing: boolean } {
  if (text === "") return { lines: [], trailing: false };
  const trailing = text.endsWith("\n");
  const body = trailing ? text.slice(0, -1) : text;
  return { lines: body.split(/\r?\n/), trailing };
}

function joinLines(lines: string[], trailing: boolean): string {
  if (lines.length === 0) return "";
  return lines.join("\n") + (trailing ? "\n" : "");
}

export function sortLines(text: string, direction: "asc" | "desc"): string {
  const { lines, trailing } = splitLines(text);
  const sorted = [...lines].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (direction === "desc") sorted.reverse();
  return joinLines(sorted, trailing);
}

/** 去重：保留首次出现的顺序 */
export function dedupeLines(text: string): string {
  const { lines, trailing } = splitLines(text);
  return joinLines([...new Set(lines)], trailing);
}

export function removeEmptyLines(text: string): string {
  const { lines, trailing } = splitLines(text);
  return joinLines(
    lines.filter((line) => line.trim() !== ""),
    trailing,
  );
}

/** 去掉每行首尾空白（空白行保留为空行） */
export function trimLines(text: string): string {
  const { lines, trailing } = splitLines(text);
  return joinLines(
    lines.map((line) => line.trim()),
    trailing,
  );
}

/** 行首按宽度补零对齐的序号，便于人工核对行数 */
export function numberLines(text: string): string {
  const { lines, trailing } = splitLines(text);
  const width = String(lines.length).length;
  return joinLines(
    lines.map((line, i) => `${String(i + 1).padStart(width, " ")}  ${line}`),
    trailing,
  );
}

export const TEXT_ACTIONS: TextAction[] = [
  { id: "sort-asc", label: "排序行 ↑", apply: (t) => sortLines(t, "asc") },
  { id: "sort-desc", label: "排序行 ↓", apply: (t) => sortLines(t, "desc") },
  { id: "dedupe", label: "去重行", apply: dedupeLines },
  { id: "trim", label: "去首尾空白", apply: trimLines },
  { id: "remove-empty", label: "去空行", apply: removeEmptyLines },
  { id: "upper", label: "转大写", apply: (t) => t.toUpperCase() },
  { id: "lower", label: "转小写", apply: (t) => t.toLowerCase() },
  { id: "number", label: "加行号", apply: numberLines },
];

export function getTextAction(id: string): TextAction | undefined {
  return TEXT_ACTIONS.find((a) => a.id === id);
}
