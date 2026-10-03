/**
 * JSON 比对纯逻辑（2026-10-03 grill 定版）：
 * - 宽松比较：标量转字符串再比——"1" ≡ 1、true ≡ "true"、null ≡ "null"、1 ≡ 1.0；
 * - 数组整体标记：不逐元素对齐，两侧数组只要不等就整块记一条差异，不深入内部；
 * - 对象递归按键比较；key 顺序、缩进空白不影响结果。
 * 自带位置感知解析：报错行号与 JS 引擎无关，且每个节点携带原文偏移，供编辑器原位高亮。
 */

export type DiffKind = "only-left" | "only-right" | "changed";

export interface DiffEntry {
  /** 点路径（根为 "(根)"）；数组不展开，路径不含下标 */
  path: string;
  kind: DiffKind;
  /** 两侧值的单行预览（截断）；侧不存在时缺省 */
  left?: string;
  right?: string;
  /** 原文高亮范围（含头不含尾），对应当前侧输入文本 */
  leftRange?: [number, number];
  rightRange?: [number, number];
}

export interface DiffError {
  message: string;
  line?: number;
}

export interface DiffResult {
  entries: DiffEntry[];
  leftError?: DiffError;
  rightError?: DiffError;
}

export const ROOT_PATH = "(根)";

// ————— 位置感知解析 —————

type SpanNode =
  | {
      kind: "object";
      start: number;
      end: number;
      props: { key: string; keyStart: number; keyEnd: number; value: SpanNode }[];
    }
  | { kind: "array"; start: number; end: number; items: SpanNode[] }
  | { kind: "scalar"; start: number; end: number; value: unknown };

class ScanError extends Error {
  constructor(
    message: string,
    readonly offset: number,
  ) {
    super(message);
  }
}

const NUM_RE = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

function parseSpans(text: string): SpanNode {
  const len = text.length;
  let pos = 0;

  const peek = () => (pos < len ? text[pos] : "");
  const ws = () => {
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 32 || c === 9 || c === 10 || c === 13) pos++;
      else break;
    }
  };
  const fail = (message: string): never => {
    throw new ScanError(message, pos);
  };

  function parseValue(): SpanNode {
    ws();
    const c = peek();
    if (c === "{") return parseObject();
    if (c === "[") return parseArray();
    const start = pos;
    if (c === '"') {
      const value = parseString();
      return { kind: "scalar", start, end: pos, value };
    }
    if (text.startsWith("true", pos)) {
      pos += 4;
      return { kind: "scalar", start, end: pos, value: true };
    }
    if (text.startsWith("false", pos)) {
      pos += 5;
      return { kind: "scalar", start, end: pos, value: false };
    }
    if (text.startsWith("null", pos)) {
      pos += 4;
      return { kind: "scalar", start, end: pos, value: null };
    }
    NUM_RE.lastIndex = pos;
    const m = NUM_RE.exec(text);
    if (m && m[0]) {
      pos = NUM_RE.lastIndex;
      return { kind: "scalar", start, end: pos, value: Number(m[0]) };
    }
    return fail("应为值");
  }

  function parseObject(): SpanNode {
    const start = pos++;
    const props: { key: string; keyStart: number; keyEnd: number; value: SpanNode }[] = [];
    ws();
    if (peek() === "}") {
      pos++;
      return { kind: "object", start, end: pos, props };
    }
    for (;;) {
      ws();
      if (peek() !== '"') fail('应为 "key": value');
      const keyStart = pos;
      const key = parseString();
      const keyEnd = pos;
      ws();
      if (peek() !== ":") fail('应为 ":"');
      pos++;
      const value = parseValue();
      props.push({ key, keyStart, keyEnd, value });
      ws();
      const c = peek();
      if (c === ",") {
        pos++;
        continue;
      }
      if (c === "}") {
        pos++;
        return { kind: "object", start, end: pos, props };
      }
      fail('应为 "," 或 "}"');
    }
  }

  function parseArray(): SpanNode {
    const start = pos++;
    const items: SpanNode[] = [];
    ws();
    if (peek() === "]") {
      pos++;
      return { kind: "array", start, end: pos, items };
    }
    for (;;) {
      items.push(parseValue());
      ws();
      const c = peek();
      if (c === ",") {
        pos++;
        continue;
      }
      if (c === "]") {
        pos++;
        return { kind: "array", start, end: pos, items };
      }
      fail('应为 "," 或 "]"');
    }
  }

  function parseString(): string {
    const start = pos++;
    while (pos < len) {
      const c = text[pos];
      if (c === '"') {
        pos++;
        return JSON.parse(text.slice(start, pos)) as string;
      }
      pos += c === "\\" ? 2 : 1;
    }
    return fail("字符串未闭合");
  }

  const node = parseValue();
  ws();
  if (pos !== len) fail("值之后存在多余内容");
  return node;
}

function lineAt(text: string, offset: number): number {
  return text.slice(0, Math.min(offset, text.length)).split("\n").length;
}

function toValue(node: SpanNode): unknown {
  if (node.kind === "scalar") return node.value;
  if (node.kind === "array") return node.items.map(toValue);
  const object: Record<string, unknown> = {};
  for (const prop of node.props) object[prop.key] = toValue(prop.value);
  return object;
}

// ————— 比较 —————

/** 宽松相等：标量 String() 后比较；对象/数组按结构递归（数组顺序敏感） */
function deepLoose(a: unknown, b: unknown): boolean {
  if (a !== null && b !== null && typeof a === "object" && typeof b === "object") {
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) {
      const bList = b as unknown[];
      return a.length === bList.length && a.every((item, i) => deepLoose(item, bList[i]));
    }
    const aRecord = a as Record<string, unknown>;
    const bRecord = b as Record<string, unknown>;
    const aKeys = Object.keys(aRecord);
    return (
      aKeys.length === Object.keys(bRecord).length &&
      aKeys.every((k) => k in bRecord && deepLoose(aRecord[k], bRecord[k]))
    );
  }
  return String(a) === String(b);
}

function preview(value: unknown): string {
  const s = JSON.stringify(value) ?? "—";
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

function joinPath(path: string, key: string): string {
  return path ? `${path}.${key}` : key;
}

function walk(l: SpanNode, r: SpanNode, path: string, out: DiffEntry[]): void {
  if (l.kind === "object" && r.kind === "object") {
    const rByKey = new Map(r.props.map((p) => [p.key, p]));
    for (const lp of l.props) {
      const rp = rByKey.get(lp.key);
      if (!rp) {
        out.push({
          path: joinPath(path, lp.key),
          kind: "only-left",
          left: preview(toValue(lp.value)),
          leftRange: [lp.keyStart, lp.value.end],
        });
      } else {
        walk(lp.value, rp.value, joinPath(path, lp.key), out);
      }
    }
    const lKeys = new Set(l.props.map((p) => p.key));
    for (const rp of r.props) {
      if (!lKeys.has(rp.key)) {
        out.push({
          path: joinPath(path, rp.key),
          kind: "only-right",
          right: preview(toValue(rp.value)),
          rightRange: [rp.keyStart, rp.value.end],
        });
      }
    }
    return;
  }

  if (l.kind === "array" && r.kind === "array") {
    if (!deepLoose(toValue(l), toValue(r))) {
      out.push({
        path: path || ROOT_PATH,
        kind: "changed",
        left: preview(toValue(l)),
        right: preview(toValue(r)),
        leftRange: [l.start, l.end],
        rightRange: [r.start, r.end],
      });
    }
    return;
  }

  if (l.kind === "scalar" && r.kind === "scalar") {
    if (String(l.value) !== String(r.value)) {
      out.push({
        path: path || ROOT_PATH,
        kind: "changed",
        left: preview(l.value),
        right: preview(r.value),
        leftRange: [l.start, l.end],
        rightRange: [r.start, r.end],
      });
    }
    return;
  }

  out.push({
    path: path || ROOT_PATH,
    kind: "changed",
    left: preview(toValue(l)),
    right: preview(toValue(r)),
    leftRange: [l.start, l.end],
    rightRange: [r.start, r.end],
  });
}

/** 纯函数：比对两份 JSON。可被 Worker 与单测直接调用。 */
export function diffJson(leftText: string, rightText: string): DiffResult {
  if (!leftText.trim() && !rightText.trim()) return { entries: [] };

  let left: SpanNode | undefined;
  let right: SpanNode | undefined;
  let leftError: DiffError | undefined;
  let rightError: DiffError | undefined;

  if (!leftText.trim()) {
    leftError = { message: "内容为空" };
  } else {
    try {
      left = parseSpans(leftText);
    } catch (err) {
      leftError =
        err instanceof ScanError
          ? { message: err.message, line: lineAt(leftText, err.offset) }
          : { message: String(err) };
    }
  }
  if (!rightText.trim()) {
    rightError = { message: "内容为空" };
  } else {
    try {
      right = parseSpans(rightText);
    } catch (err) {
      rightError =
        err instanceof ScanError
          ? { message: err.message, line: lineAt(rightText, err.offset) }
          : { message: String(err) };
    }
  }

  if (leftError || rightError) return { entries: [], leftError, rightError };

  const entries: DiffEntry[] = [];
  walk(left!, right!, "", entries);
  return { entries };
}
