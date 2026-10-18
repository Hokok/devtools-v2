/**
 * JSON 树视图的纯逻辑（ADR-0005）：
 * 把输出文本解析成可折叠树节点，附「定位路径」语法的路径与超阈判定。
 * 解析复用 ./scan 的位置感知扫描——每个节点携带原文 span，
 * 树的"点节点跳回文本视图"与比对的差异标色都靠它。
 *
 * 铁律：树只是输出文本的另一种渲染。这里的产物不含任何"新输出"，
 * 子树复制直接切原文 slice，不重新序列化。
 */

import { ScanError, parseSpans, type SpanNode } from "./scan";

/** 树视图阈值（CONTEXT.md）：超 512K 字符直接回落文本视图，不做 DOM 树 */
export const TREE_MAX_CHARS = 512 * 1024;
/** 超过 2 万节点同样回落——默认全展开时行数 ≈ 节点数 */
export const TREE_MAX_NODES = 20000;

export type TreeValueType = "object" | "array" | "string" | "number" | "boolean" | "null";

export interface JsonTreeNode {
  /** 「定位路径」语法（点路径 + [n]，见 CONTEXT.md）；根为 "" */
  path: string;
  /** 行首显示名：对象的 key、数组的下标、根为 "(根)" */
  key: string;
  /** 数组元素（key 为下标） */
  isIndex: boolean;
  type: TreeValueType;
  /** 标量显示文本（字符串带引号转义）；容器节点为空串 */
  text: string;
  children: JsonTreeNode[];
  /** 是否画折叠三角（空对象/空数组不可折叠） */
  expandable: boolean;
  /** 该节点「值」的原文 span（含头不含尾），跳行与 diff 对齐用 */
  start: number;
  end: number;
}

export type JsonTreeBuild =
  | { kind: "tree"; root: JsonTreeNode; nodes: number }
  | { kind: "too-large"; chars: number }
  | { kind: "invalid"; message: string };

/** 纯函数：把 JSON 文本建成树，或给出回落/非法的原因。 */
export function buildJsonTree(text: string): JsonTreeBuild {
  if (text.length > TREE_MAX_CHARS) return { kind: "too-large", chars: text.length };

  let span: SpanNode;
  try {
    span = parseSpans(text);
  } catch (err) {
    return { kind: "invalid", message: err instanceof ScanError ? err.message : String(err) };
  }

  const counter = { nodes: 0 };
  const root = toNode(span, "", "(根)", false, counter);
  if (counter.nodes > TREE_MAX_NODES) return { kind: "too-large", chars: text.length };
  return { kind: "tree", root, nodes: counter.nodes };
}

function toNode(
  span: SpanNode,
  path: string,
  key: string,
  isIndex: boolean,
  counter: { nodes: number },
): JsonTreeNode {
  counter.nodes++;
  switch (span.kind) {
    case "object": {
      const children = span.props.map((p) =>
        toNode(p.value, path ? `${path}.${p.key}` : p.key, p.key, false, counter),
      );
      return {
        path, key, isIndex, type: "object", text: "", children,
        expandable: children.length > 0, start: span.start, end: span.end,
      };
    }
    case "array": {
      const children = span.items.map((item, i) =>
        toNode(item, path ? `${path}[${i}]` : `[${i}]`, String(i), true, counter),
      );
      return {
        path, key, isIndex, type: "array", text: "", children,
        expandable: children.length > 0, start: span.start, end: span.end,
      };
    }
    default:
      return {
        path, key, isIndex,
        type: span.value === null ? "null"
          : typeof span.value === "string" ? "string"
            : typeof span.value === "boolean" ? "boolean" : "number",
        text: typeof span.value === "string" ? JSON.stringify(span.value) : String(span.value),
        children: [],
        expandable: false,
        start: span.start,
        end: span.end,
      };
  }
}

/**
 * 差异标色映射：某节点的值 span 被某个高亮 range 覆盖时，取该 range 的 class
 * （与编辑器原位高亮同源，见 JsonDiff 的 leftRange/rightRange）。
 * 覆盖而非相等——「仅一侧存在」的 range 从 key 起头，整棵子树都该被标上。
 */
export function pickMark(
  start: number,
  end: number,
  marks: readonly { from: number; to: number; className: string }[],
): string | undefined {
  for (const mark of marks) {
    if (mark.from <= start && end <= mark.to) return mark.className;
  }
  return undefined;
}

/** 搜索的命中集合：key 或字符串值包含查询（大小写不敏感子串）；祖先连带可见。 */
export function collectMatches(root: JsonTreeNode, query: string): Set<JsonTreeNode> {
  const q = query.trim().toLowerCase();
  const visible = new Set<JsonTreeNode>();
  if (!q) return visible;

  const walk = (node: JsonTreeNode): boolean => {
    let descendant = false;
    for (const child of node.children) {
      if (walk(child)) descendant = true;
    }
    const self =
      node.key.toLowerCase().includes(q) ||
      (node.type === "string" && node.text.toLowerCase().includes(q));
    if (self || descendant) visible.add(node);
    return self || descendant;
  };
  walk(root);
  return visible;
}

export interface TreeRow {
  node: JsonTreeNode;
  depth: number;
}

/**
 * 按可见性拍平成渲染行。搜索态强制全展开且只保留命中分支；
 * 平时按折叠集合隐藏子树（默认全展开 = 折叠集合为空，见 ADR-0005）。
 * 容器型根节点不占一行——顶层 key 从第 0 层排（行首多一行「(根)」是噪声）；
 * 标量根仍显示一行。
 */
export function flattenRows(
  root: JsonTreeNode,
  collapsed: ReadonlySet<JsonTreeNode>,
  hits?: ReadonlySet<JsonTreeNode>,
): TreeRow[] {
  const rows: TreeRow[] = [];
  // 容器型根被隐藏时，其子行从第 0 层排（base 记上根的缺的一层）
  const base = root.expandable ? -1 : 0;
  const push = (node: JsonTreeNode, depth: number, hidden: boolean) => {
    if (!hidden) rows.push({ node, depth });
    if (!node.expandable) return;
    // 搜索态无视折叠，命中分支全部展开
    if (!hits && collapsed.has(node)) return;
    for (const child of node.children) {
      if (hits && !hits.has(child)) continue;
      push(child, depth + 1, false);
    }
  };
  if (!hits || hits.has(root)) push(root, base, root.expandable);
  return rows;
}

/** 全部可折叠节点（折叠全部用） */
export function collectExpandable(root: JsonTreeNode): JsonTreeNode[] {
  const out: JsonTreeNode[] = [];
  const walk = (node: JsonTreeNode) => {
    if (node.expandable) out.push(node);
    for (const child of node.children) walk(child);
  };
  walk(root);
  return out;
}
