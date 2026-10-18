/**
 * JSON 比对纯逻辑（2026-10-03 grill 定版）：
 * - 宽松比较：标量转字符串再比——"1" ≡ 1、true ≡ "true"、null ≡ "null"、1 ≡ 1.0；
 * - 数组整体标记：不逐元素对齐，两侧数组只要不等就整块记一条差异，不深入内部；
 * - 对象递归按键比较；key 顺序、缩进空白不影响结果。
 * 位置感知解析来自 ../json-common/scan：报错行号与 JS 引擎无关，且每个节点携带
 * 原文偏移，供编辑器原位高亮。
 */

import { ScanError, lineAt, parseSpans, type SpanNode } from "../json-common/scan";

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

function toValue(node: SpanNode): unknown {
  if (node.kind === "scalar") return node.value;
  if (node.kind === "array") return node.items.map(toValue);
  const object: Record<string, unknown> = {};
  for (const prop of node.props) object[prop.key] = toValue(prop.value);
  return object;
}

// ————— 比较 —————

/** 自身属性判定——避免 `in` 命中原型链（constructor/toString 等假命中） */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

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
      aKeys.every((k) => hasOwn(bRecord, k) && deepLoose(aRecord[k], bRecord[k]))
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

export const DIFF_KIND_LABEL: Record<DiffKind, string> = {
  "only-left": "仅左",
  "only-right": "仅右",
  changed: "值不同",
};

/**
 * 差异清单的纯文本报告——差异比对的"产物"。
 * 「发送到…」送的就是它：往文本处理里一送就能排序/去重，往别处一送就是一份可写进
 * PR 或 issue 的变更说明。空清单返回空串（调用方据此禁用动作）。
 */
export function diffReport(entries: DiffEntry[]): string {
  return entries
    .map((e) => `${e.path}  [${DIFF_KIND_LABEL[e.kind]}]  ${e.left ?? "—"} → ${e.right ?? "—"}`)
    .join("\n");
}
