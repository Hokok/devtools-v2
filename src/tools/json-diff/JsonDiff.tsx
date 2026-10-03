import { useMemo, useRef, useState } from "react";
import { EditorView } from "@codemirror/view";
import {
  ArrowLeftRight,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Eraser,
  Sparkles,
} from "lucide-react";
import { CodeEditor, type EditorMark } from "../../editor/CodeEditor";
import { readText } from "../../platform/clipboard";
import type { ToolComponentProps } from "../../platform/types";
import { diffJson, type DiffEntry, type DiffError, type DiffKind } from "./diff";

const JSON_LANG = () => import("@codemirror/lang-json").then((m) => m.json());

const SAMPLE_LEFT = `{
  "app": "devtools",
  "version": "0.1.0",
  "features": ["diff", "extract"],
  "limits": { "users": 5 }
}`;
const SAMPLE_RIGHT = `{
  "app": "devtools",
  "version": "0.2.0",
  "features": ["diff", "extract", "csv"],
  "limits": { "users": 5, "threads": 4 },
  "owner": "huangzhan"
}`;

const KIND_META: Record<DiffKind, { label: string; dot: string }> = {
  "only-left": { label: "仅左", dot: "bg-danger" },
  "only-right": { label: "仅右", dot: "bg-ok" },
  changed: { label: "值不同", dot: "bg-warn" },
};

const MARK_CLASS: Record<DiffKind, string> = {
  "only-left": "cm-diff-only-left",
  "only-right": "cm-diff-only-right",
  changed: "cm-diff-changed",
};

/**
 * 异形布局（ADR-0003 逃逸）：左右两个编辑器原位高亮差异，底部差异清单可点击跳转。
 * 差异计算是线性扫描，实时同步进行（与正则测试器不同，无病态输入风险，不必进 Worker）。
 */
export function JsonDiff({ input, onInput }: ToolComponentProps) {
  const [right, setRight] = useState("");
  const [listOpen, setListOpen] = useState(true);
  const leftView = useRef<EditorView | null>(null);
  const rightView = useRef<EditorView | null>(null);

  const result = useMemo(() => diffJson(input, right), [input, right]);

  const leftMarks = useMemo(() => collectMarks(result.entries, "leftRange"), [result.entries]);
  const rightMarks = useMemo(() => collectMarks(result.entries, "rightRange"), [result.entries]);

  const swap = () => {
    const left = input;
    onInput(right);
    setRight(left);
  };

  const jump = (range: [number, number] | undefined, side: "left" | "right") => {
    const view = side === "left" ? leftView.current : rightView.current;
    if (!view || !range) return;
    view.dispatch({
      selection: { anchor: range[0], head: range[1] },
      effects: EditorView.scrollIntoView(range[0], { y: "center" }),
    });
    view.focus();
  };

  let summary: { text: string; ok: boolean };
  if (result.leftError || result.rightError) {
    summary = { text: "存在解析错误", ok: false };
  } else if (result.entries.length === 0) {
    summary = { text: "两侧一致", ok: true };
  } else {
    const n = result.entries.length;
    const onlyLeft = result.entries.filter((e) => e.kind === "only-left").length;
    const onlyRight = result.entries.filter((e) => e.kind === "only-right").length;
    summary = {
      text: `${n} 处差异 · 仅左 ${onlyLeft} · 仅右 ${onlyRight} · 值不同 ${n - onlyLeft - onlyRight}`,
      ok: false,
    };
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 p-2">
      <div className="flex min-h-0 flex-1 gap-2">
        <SideCard
          side="left"
          value={input}
          onChange={onInput}
          marks={leftMarks}
          error={result.leftError}
          onViewReady={(view) => (leftView.current = view)}
          actions={
            <>
              <button className="icon-btn" title="交换左右" onClick={swap}>
                <ArrowLeftRight size={13} />
              </button>
              <button
                className="icon-btn"
                title="载入示例"
                onClick={() => {
                  onInput(SAMPLE_LEFT);
                  setRight(SAMPLE_RIGHT);
                }}
              >
                <Sparkles size={13} />
              </button>
            </>
          }
        />
        <SideCard
          side="right"
          value={right}
          onChange={setRight}
          marks={rightMarks}
          error={result.rightError}
          onViewReady={(view) => (rightView.current = view)}
        />
      </div>

      <section className={`card flex shrink-0 flex-col overflow-hidden ${listOpen ? "h-44" : "h-8"}`}>
        <header className="flex h-8 shrink-0 items-center gap-2 px-3">
          <span className="select-none text-2xs font-medium uppercase tracking-[0.08em] text-muted">
            差异清单
          </span>
          <span className={`truncate text-2xs ${summary.ok ? "text-ok" : "text-faint"}`}>
            {summary.text}
          </span>
          <button
            className="icon-btn ml-auto"
            title={listOpen ? "收起清单" : "展开清单"}
            onClick={() => setListOpen((v) => !v)}
          >
            {listOpen ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          </button>
        </header>
        {listOpen && (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {result.entries.length === 0 ? (
              <p className="px-3 py-3 text-xs text-faint">
                {result.leftError || result.rightError
                  ? "修正解析错误后这里显示差异"
                  : "粘贴两份 JSON 开始比对；红=仅左有，绿=仅右有，黄=值不同"}
              </p>
            ) : (
              result.entries.map((entry, i) => (
                <DiffRow
                  key={i}
                  entry={entry}
                  onJump={(range, side) => jump(range, side)}
                />
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function collectMarks(entries: DiffEntry[], key: "leftRange" | "rightRange"): EditorMark[] {
  const marks: EditorMark[] = [];
  for (const entry of entries) {
    const range = entry[key];
    if (range) marks.push({ from: range[0], to: range[1], className: MARK_CLASS[entry.kind] });
  }
  return marks;
}

function SideCard({
  side,
  value,
  onChange,
  marks,
  error,
  onViewReady,
  actions,
}: {
  side: "left" | "right";
  value: string;
  onChange: (value: string) => void;
  marks: EditorMark[];
  error?: DiffError;
  onViewReady: (view: EditorView | null) => void;
  actions?: React.ReactNode;
}) {
  return (
    <section className="card flex min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex h-8 shrink-0 items-center gap-2 px-3">
        <span className="select-none text-2xs font-medium uppercase tracking-[0.08em] text-muted">
          {side === "left" ? "A · 左侧" : "B · 右侧"}
        </span>
        {error && (
          <span className="truncate text-2xs text-danger" title={error.message}>
            {error.message}
            {error.line !== undefined && `（第 ${error.line} 行）`}
          </span>
        )}
        <span className="ml-auto flex items-center gap-0.5">
          {actions}
          <PasteButton onPaste={onChange} />
          <button className="icon-btn" title="清空" disabled={!value} onClick={() => onChange("")}>
            <Eraser size={13} />
          </button>
        </span>
      </header>
      <div className="min-h-0 flex-1">
        <CodeEditor
          value={value}
          onChange={onChange}
          language={JSON_LANG}
          marks={marks}
          onViewReady={onViewReady}
          placeholder={side === "left" ? "粘贴左侧 JSON…" : "粘贴右侧 JSON…"}
        />
      </div>
    </section>
  );
}

function PasteButton({ onPaste }: { onPaste: (text: string) => void }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="icon-btn"
      title={ok ? "已粘贴" : "粘贴"}
      onClick={async () => {
        try {
          const text = await readText();
          if (text) {
            onPaste(text);
            setOk(true);
            setTimeout(() => setOk(false), 1200);
          }
        } catch {
          /* 无剪贴板权限时静默（与正则测试器一致） */
        }
      }}
    >
      {ok ? <Check size={13} className="text-ok" /> : <ClipboardPaste size={13} />}
    </button>
  );
}

function DiffRow({
  entry,
  onJump,
}: {
  entry: DiffEntry;
  onJump: (range: [number, number] | undefined, side: "left" | "right") => void;
}) {
  const meta = KIND_META[entry.kind];
  return (
    <button
      onClick={() => {
        onJump(entry.leftRange, "left");
        onJump(entry.rightRange, "right");
      }}
      title={entry.path}
      className="flex w-full items-center gap-2 border-b border-line/60 px-3 py-1.5 text-left last:border-b-0 hover:bg-hover"
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
      <span className="w-11 shrink-0 text-2xs text-muted">{meta.label}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-text">{entry.path}</span>
      <span className="max-w-[45%] shrink-0 truncate text-right font-mono text-2xs text-faint">
        {entry.left ?? "—"}
        <span className="mx-1 opacity-60">→</span>
        {entry.right ?? "—"}
      </span>
    </button>
  );
}
