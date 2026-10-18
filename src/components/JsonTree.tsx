import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import {
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FoldVertical,
  Route,
  Search,
  UnfoldVertical,
  X,
} from "lucide-react";
import { copyText } from "../platform/clipboard";
import { jumpToLine } from "../platform/editorJump";
import { lineAt } from "../tools/json-common/scan";
import {
  collectExpandable,
  collectMatches,
  flattenRows,
  pickMark,
  type JsonTreeBuild,
  type JsonTreeNode,
} from "../tools/json-common/tree";
import type { EditorMark } from "../editor/CodeEditor";

export type OutputViewMode = "tree" | "text";

/** 树视图可用的 build 窄化（调用方据此决定渲染树还是文本） */
export type ReadyJsonTree = Extract<JsonTreeBuild, { kind: "tree" }>;

/**
 * 「树 | 文本」分段控件（ADR-0005）。样式对齐 JSON 提取里 JSON/CSV 的分段。
 * 取值属工具配置：跟工具走、跨重启保留，由调用方写进 onSettingsChange。
 */
export function ViewToggle({
  value,
  onChange,
}: {
  value: OutputViewMode;
  onChange: (mode: OutputViewMode) => void;
}) {
  return (
    <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-raise p-0.5">
      {(["tree", "text"] as const).map((mode) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`pressable rounded px-1.5 py-0.5 text-2xs ${
            value === mode ? "bg-active text-accent" : "text-muted hover:text-text"
          }`}
          title={mode === "tree" ? "树视图：结构化浏览（只读）" : "文本视图：纯文本（复制的载荷）"}
        >
          {mode === "tree" ? "树" : "文本"}
        </button>
      ))}
    </span>
  );
}

/**
 * 树→文本跳行的共享胶水：点树节点先切到文本视图，渲染提交后等一帧再定位——
 * CodeMirror 要有布局才能 scrollIntoView。viewRef 交给文本视图的 CodeEditor 挂。
 */
export function useTreeViewJump(setView: (mode: OutputViewMode) => void) {
  const viewRef = useRef<EditorView | null>(null);
  const [pending, setPending] = useState<number | null>(null);

  const jumpTo = useCallback(
    (line: number) => {
      setView("text");
      setPending(line);
    },
    [setView],
  );

  useEffect(() => {
    if (pending === null) return;
    const raf = requestAnimationFrame(() => {
      jumpToLine(viewRef.current, pending);
      setPending(null);
    });
    return () => cancelAnimationFrame(raf);
  }, [pending]);

  return { viewRef, jumpTo };
}

const VALUE_CLASS: Record<string, string> = {
  string: "jt-str",
  number: "jt-num",
  boolean: "jt-bool",
  null: "jt-null",
};

/** JSON 输出的结构树视图（ADR-0005）：只读渲染，本身不是输出。 */
export function JsonTreeView({
  build,
  text,
  marks,
  jumpTo,
}: {
  build: ReadyJsonTree;
  /** 原文（跳行与子树切片的来源） */
  text: string;
  /** 差异标色（与编辑器原位高亮同源的 range → class） */
  marks?: EditorMark[];
  /** 点节点 → 跳回文本视图对应行 */
  jumpTo?: (line: number) => void;
}) {
  const root = build.root;
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<ReadonlySet<JsonTreeNode>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);
  // 文本一变，旧的折叠集合对不上新节点——回到「默认全展开」
  useEffect(() => setCollapsed(new Set()), [text]);

  const hits = useMemo(
    () => (query.trim() ? collectMatches(root, query) : undefined),
    [root, query],
  );
  const rows = useMemo(
    () => (query.trim() ? flattenRows(root, collapsed, hits ?? new Set()) : flattenRows(root, collapsed)),
    [root, collapsed, hits, query],
  );
  const markRows = useMemo(() => {
    if (!marks?.length) return undefined;
    const map = new Map<JsonTreeNode, string>();
    const walk = (node: JsonTreeNode) => {
      const cls = pickMark(node.start, node.end, marks);
      if (cls) map.set(node, cls);
      for (const child of node.children) walk(child);
    };
    walk(root);
    return map;
  }, [root, marks]);

  const doCopy = useCallback(
    async (kind: "value" | "path" | "slice", node: JsonTreeNode) => {
      const payload =
        kind === "value" || kind === "slice"
          ? // 标量字符串的"值"不带引号；其余都是原文切片（子树 copy 不重新序列化）
            kind === "value" && node.type === "string"
            ? (JSON.parse(node.text) as string)
            : text.slice(node.start, node.end)
          : node.path;
      await copyText(payload);
      setCopied(`${kind}@${node.path}`);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(null), 1200);
    },
    [text],
  );

  const onToggle = useCallback((node: JsonTreeNode) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.delete(node)) return next;
      next.add(node);
      return next;
    });
  }, []);
  const onJumpLine = useCallback((node: JsonTreeNode) => lineAt(text, node.start), [text]);

  const searching = query.trim() !== "";
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* 树自己的工具条：搜索 + 展开全部 / 折叠全部（完整交互集） */}
      <div className="flex h-7 shrink-0 items-center gap-1.5 border-b border-line/40 px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md bg-raise px-1.5 py-0.5">
          <Search size={11} className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索 key 或字符串值…"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent font-mono text-2xs text-text outline-none placeholder:text-faint"
          />
          {searching && (
            <button className="icon-btn h-4 w-4" title="清除搜索" onClick={() => setQuery("")}>
              <X size={11} />
            </button>
          )}
        </div>
        <span className="shrink-0 text-2xs text-faint">
          {searching ? `${hits?.size ?? 0} / ${build.nodes} 节点` : `${build.nodes} 节点`}
        </span>
        <button className="icon-btn" title="展开全部" onClick={() => setCollapsed(new Set())}>
          <UnfoldVertical size={13} />
        </button>
        <button
          className="icon-btn"
          title="折叠全部（根不折）"
          onClick={() => setCollapsed(new Set(collectExpandable(root).filter((n) => n !== root)))}
        >
          <FoldVertical size={13} />
        </button>
      </div>

      <div className="min-h-0 flex-1 select-text overflow-auto py-1 font-mono text-xs">
        {rows.length === 0 && searching ? (
          <p className="px-3 py-2 text-2xs text-faint">无匹配</p>
        ) : (
          rows.map((row, i) => (
            <NodeRow
              key={`${row.node.start}:${i}`}
              row={row}
              markClass={markRows?.get(row.node)}
              collapsed={collapsed.has(row.node)}
              copied={copied}
              onCopy={doCopy}
              onToggle={onToggle}
              onJump={jumpTo ? () => jumpTo(onJumpLine(row.node)) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}

const CONTAINER_TEXT: Record<string, { open: string; close: string }> = {
  object: { open: "{ … }", close: "{}" },
  array: { open: "[ … ]", close: "[]" },
};

function NodeRow({
  row,
  markClass,
  collapsed,
  copied,
  onCopy,
  onToggle,
  onJump,
}: {
  row: { node: JsonTreeNode; depth: number };
  markClass?: string;
  collapsed: boolean;
  copied: string | null;
  onCopy: (kind: "value" | "path" | "slice", node: JsonTreeNode) => Promise<void>;
  onToggle: (node: JsonTreeNode) => void;
  onJump?: () => void;
}) {
  const { node, depth } = row;
  const isContainer = node.type === "object" || node.type === "array";
  const shape = CONTAINER_TEXT[node.type];
  const activeCopied = copied === `value@${node.path}`;

  return (
    <div
      className={`group relative flex min-w-0 items-baseline rounded leading-6 ${markClass ?? ""} ${onJump ? "cursor-pointer" : ""}`}
      style={{ paddingLeft: depth * 14 + 4 }}
      title={onJump ? "点击跳到文本视图对应行" : undefined}
      onClick={onJump}
    >
      <span className="flex w-3.5 shrink-0 justify-center">
        {node.expandable && (
          <button
            className="pressable text-faint hover:text-accent"
            title={collapsed ? "展开" : "收起"}
            onClick={(e) => {
              e.stopPropagation();
              onToggle(node);
            }}
          >
            {collapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
      </span>

      <span
        className={`${node.isIndex ? "jt-index" : "jt-key"} shrink-0 max-w-40 truncate`}
        title={node.path}
      >
        {node.key}
      </span>
      <span className="jt-punct shrink-0">: </span>
      {isContainer ? (
        <span className="jt-meta shrink-0">
          {node.expandable ? shape.open : shape.close}
          {node.expandable ? ` ${node.children.length} 项` : ""}
        </span>
      ) : (
        <span className={`${VALUE_CLASS[node.type] ?? "jt-punct"} min-w-0 truncate`} title={node.text}>
          {node.text}
        </span>
      )}

      {/* 悬停操作条：复制值 / 复制路径 / 复制子树 */}
      <div
        className="absolute right-1 top-0.5 z-10 hidden items-center gap-px rounded-md border border-line/60 bg-panel/90 px-px shadow group-hover:flex"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="icon-btn h-5 w-5"
          title={activeCopied ? "已复制" : "复制值"}
          onClick={() => void onCopy("value", node)}
        >
          {activeCopied ? <Check size={11} className="text-ok" /> : <Copy size={11} />}
        </button>
        <button
          className="icon-btn h-5 w-5"
          title={copied === `path@${node.path}` ? "已复制" : "复制路径（定位路径语法）"}
          disabled={!node.path}
          onClick={() => void onCopy("path", node)}
        >
          {copied === `path@${node.path}` ? (
            <Check size={11} className="text-ok" />
          ) : (
            <Route size={11} />
          )}
        </button>
        <button
          className="icon-btn h-5 w-5"
          title={copied === `slice@${node.path}` ? "已复制" : "复制子树"}
          disabled={!node.expandable}
          onClick={() => void onCopy("slice", node)}
        >
          {copied === `slice@${node.path}` ? (
            <Check size={11} className="text-ok" />
          ) : (
            <Braces size={11} />
          )}
        </button>
      </div>
    </div>
  );
}
