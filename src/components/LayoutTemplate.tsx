import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { EditorView } from "@codemirror/view";
import { foldAll, unfoldAll } from "@codemirror/language";
import {
  ArrowLeftRight,
  Check,
  ClipboardPaste,
  Copy,
  Eraser,
  FoldVertical,
  LoaderCircle,
  Sparkles,
  TriangleAlert,
  UnfoldVertical,
} from "lucide-react";
import { CodeEditor } from "../editor/CodeEditor";
import { copyText, readText } from "../platform/clipboard";
import { useToolTransform } from "../platform/hooks";
import { fmtCount, fmtMs } from "../platform/format";
import { useUi } from "../platform/stores/ui";
import type { LoadedTool, ToolSettings } from "../platform/types";

interface LayoutTemplateProps {
  tool: LoadedTool;
  input: string;
  onInput: (value: string) => void;
  settings: ToolSettings;
}

/**
 * 布局模板（ADR-0003）：输入区 → 分隔条 → 输出区。
 * 分隔条可拖拽（比例按工具记忆，双击复位），适配大文本查看；
 * 80% 的工具只写 transform 即可获得完整交互；耗时就地显示。
 */
export function LayoutTemplate({ tool, input, onInput, settings }: LayoutTemplateProps) {
  const { result, elapsed, running } = useToolTransform(tool, input, settings, useLiveTick(tool, input));
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState(false);
  const [pasteFailed, setPasteFailed] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inputViewRef = useRef<EditorView | null>(null);

  // 分栏：比例按工具持久化，拖拽中直接改 store（clamp 在 store 内做）；
  // 方向全局统一（vertical 上下 | horizontal 左右），同一比例两种方向共用
  const ratio = useUi((s) => s.splitRatios[tool.id] ?? 0.5);
  const setSplitRatio = useUi((s) => s.setSplitRatio);
  const horizontal = useUi((s) => s.layoutDirection === "horizontal");
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ start: number; startRatio: number; size: number } | null>(null);

  useEffect(() => () => {
    clearTimeout(copiedTimer.current);
    clearTimeout(feedbackTimer.current);
  }, []);

  const language = useMemo(() => tool.language, [tool]);
  const inputMeta = useMemo(() => (input ? fmtCount(input) : undefined), [input]);
  const hasOutput = result.output !== undefined && result.output !== "";

  const flash = useCallback((setter: (v: boolean) => void) => {
    setter(true);
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => {
      setter(false);
      setPasted(false);
    }, 1500);
  }, []);

  const doCopy = useCallback(async () => {
    if (!result.output) return;
    await copyText(result.output);
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1200);
  }, [result.output]);

  const doPaste = useCallback(async () => {
    try {
      const text = await readText();
      if (text) {
        onInput(text);
        setPasted(true);
        setPasteFailed(false);
        flash(setPasted);
      }
    } catch {
      // 无剪贴板权限：给可见反馈而不是静默吞掉
      setPasted(false);
      flash(setPasteFailed);
    }
  }, [onInput, flash]);

  return (
    <div ref={containerRef} className={`flex h-full min-h-0 gap-0.5 p-1 ${horizontal ? "flex-row" : "flex-col"}`}>
      <div
        className="flex min-h-0 min-w-0"
        style={horizontal ? { width: `${ratio * 100}%` } : { height: `${ratio * 100}%` }}
      >
        <Card
          label="输入"
          meta={inputMeta}
          actions={
            <>
              {language && (
                <>
                  <button
                    className="icon-btn"
                    title="折叠全部"
                    onClick={() => inputViewRef.current && foldAll(inputViewRef.current)}
                  >
                    <FoldVertical size={13} />
                  </button>
                  <button
                    className="icon-btn"
                    title="展开全部"
                    onClick={() => inputViewRef.current && unfoldAll(inputViewRef.current)}
                  >
                    <UnfoldVertical size={13} />
                  </button>
                </>
              )}
              {tool.sample && (
                <button className="icon-btn" title="载入示例" onClick={() => onInput(tool.sample ?? "")}>
                  <Sparkles size={13} />
                </button>
              )}
              <button
                className="icon-btn"
                title={pasteFailed ? "剪贴板不可读" : pasted ? "已粘贴" : "粘贴"}
                onClick={doPaste}
              >
                {pasteFailed ? (
                  <TriangleAlert size={13} className="text-danger" />
                ) : pasted ? (
                  <Check size={13} className="text-ok" />
                ) : (
                  <ClipboardPaste size={13} />
                )}
              </button>
              <button className="icon-btn" title="清空" disabled={!input} onClick={() => onInput("")}>
                <Eraser size={13} />
              </button>
            </>
          }
        >
          <CodeEditor
            value={input}
            onChange={onInput}
            language={language}
            onViewReady={(view) => (inputViewRef.current = view)}
            placeholder={tool.inputPlaceholder ?? `在此输入${tool.name}要处理的内容…`}
          />
        </Card>
      </div>

      {/* 可拖拽分隔条：拖动调整比例，双击复位；方向随布局方向互换 */}
      <div
        role="separator"
        aria-orientation={horizontal ? "vertical" : "horizontal"}
        title="拖动调整分栏 · 双击复位"
        className={`group relative shrink-0 touch-none ${horizontal ? "w-3 cursor-col-resize" : "h-3 cursor-row-resize"}`}
        onPointerDown={(e) => {
          const rect = containerRef.current?.getBoundingClientRect();
          if (!rect) return;
          dragState.current = {
            start: horizontal ? e.clientX : e.clientY,
            startRatio: ratio,
            size: horizontal ? rect.width : rect.height,
          };
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* 合成事件等无原生指针场景可不捕获，move 事件仍会派发到元素 */
          }
        }}
        onPointerMove={(e) => {
          const d = dragState.current;
          if (!d) return;
          const pos = horizontal ? e.clientX : e.clientY;
          setSplitRatio(tool.id, d.startRatio + (pos - d.start) / d.size);
        }}
        onPointerUp={(e) => {
          dragState.current = null;
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {
            /* 同上 */
          }
        }}
        onDoubleClick={() => setSplitRatio(tool.id, 0.5)}
      >
        {horizontal ? (
          <>
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line transition-colors group-hover:bg-accent-dim" />
            <div className="absolute left-1/2 top-1/2 h-10 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-line transition-colors group-hover:bg-accent/60" />
          </>
        ) : (
          <>
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-line transition-colors group-hover:bg-accent-dim" />
            <div className="absolute inset-x-1/2 top-1/2 h-[3px] w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-line transition-colors group-hover:bg-accent/60" />
          </>
        )}
      </div>

      <div className={`flex min-h-0 min-w-0 flex-1 ${horizontal ? "flex-row" : "flex-col"}`}>
        <Card
          label="输出"
          meta={
            running ? (
              <span className="flex items-center gap-1 text-muted">
                <LoaderCircle size={11} className="animate-spin" />
                计算中…
              </span>
            ) : result.error ? undefined : hasOutput ? (
              <span className="text-ok">✓ {fmtMs(elapsed)}</span>
            ) : undefined
          }
          actions={
            <>
              <button
                className="icon-btn"
                title="结果作为输入"
                disabled={!hasOutput}
                onClick={() => onInput(result.output ?? "")}
              >
                <ArrowLeftRight size={13} />
              </button>
              <button className="icon-btn" title={copied ? "已复制" : "复制输出"} disabled={!hasOutput} onClick={doCopy}>
                {copied ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
              </button>
            </>
          }
        >
          {result.error && (
            <div className="mx-2 mt-1 flex items-start gap-2 rounded-md border border-danger/25 bg-danger/8 px-2.5 py-1.5 text-xs text-danger">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              <span className="break-all">
                {result.error.message}
                {result.error.line !== undefined && `（第 ${result.error.line} 行）`}
              </span>
            </div>
          )}
          <div className={result.error ? "h-full min-h-0 flex-1 opacity-45" : "h-full min-h-0 flex-1"}>
            <CodeEditor value={result.output ?? ""} readOnly placeholder="转换结果" language={language} />
          </div>
        </Card>
      </div>
    </div>
  );
}

/** 空输入的 live 工具（时间戳）每秒重跑一次，让"当前时刻"真正实时 */
function useLiveTick(tool: LoadedTool, input: string): number {
  const [tick, bump] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    if (!tool.live || input) return;
    const timer = setInterval(bump, 1000);
    return () => clearInterval(timer);
  }, [tool.live, input]);
  return tick;
}

function Card({
  label,
  meta,
  actions,
  children,
}: {
  label: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg border border-line bg-panel">
      <header className="flex h-6 shrink-0 items-center gap-1.5 border-b border-line px-2">
        <span className="text-[10px] font-medium tracking-[0.18em] text-faint uppercase">{label}</span>
        <span className="truncate text-[10px] text-faint">{meta}</span>
        <span className="ml-auto flex items-center gap-0.5">{actions}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}
