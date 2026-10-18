/**
 * 折叠占位符的计数（ADR-0005 否决树视图后的文本侧增强）：
 * 输出/输入的 JSON 折叠后， Apifox 式地显示「{ … } N 项」。
 * 计数复用 ./scan 的 span 扫描——折叠 range（CodeMirror 的 fold from.. 含大括号）
 * 与 span 的 start/end（含大括号）同源，天然对齐。
 */

import { parseSpans, type SpanNode } from "./scan";

export interface JsonFoldInfo {
  kind: "object" | "array";
  count: number;
}

/** 单条缓存：折叠占位符渲染频繁，但同一份文本不去重复扫描 */
let cacheText: string | undefined;
let cacheRoot: SpanNode | undefined;
let cacheOk = false;

function rootOf(text: string): SpanNode | undefined {
  if (text === cacheText) return cacheOk ? cacheRoot : undefined;
  try {
    cacheRoot = parseSpans(text);
    cacheOk = true;
  } catch {
    cacheOk = false;
  }
  cacheText = text;
  return cacheOk ? cacheRoot : undefined;
}

/**
 * 折叠 range [from, to)（含大括号）对应的容器与其直接子项数；
 * 文本非法或 range 不是容器时返回 undefined（占位符回落 "…"）。
 */
export function jsonFoldInfo(text: string, from: number, to: number): JsonFoldInfo | undefined {
  const root = rootOf(text);
  if (!root) return undefined;

  type ContainerNode = Extract<SpanNode, { kind: "object" | "array" }>;
  /** 找最内层的、完全盖住 [from,to) 的容器 */
  const drill = (node: SpanNode): ContainerNode | undefined => {
    if (node.start > from || node.end < to) return undefined;
    switch (node.kind) {
      case "scalar":
        return undefined;
      case "object":
        for (const { value } of node.props) {
          const hit = drill(value);
          if (hit) return hit;
        }
        return node;
      case "array":
        for (const item of node.items) {
          const hit = drill(item);
          if (hit) return hit;
        }
        return node;
    }
  };

  const node = drill(root);
  if (!node) return undefined;
  return {
    kind: node.kind,
    count: node.kind === "object" ? node.props.length : node.items.length,
  };
}

/** 占位符文案：容器给「… N 项」（大括号由 foldInside 保留在两侧）；其余回落 "…" */
export function foldPlaceholderText(text: string, from: number, to: number): string {
  const info = jsonFoldInfo(text, from, to);
  if (!info) return "…";
  return `… ${info.count} 项`;
}
