import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  ClipboardPaste,
  Copy,
  Eraser,
  Plus,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { CodeEditor } from "../../editor/CodeEditor";
import { copyText, readText } from "../../platform/clipboard";
import { saveTextFile } from "../../platform/saveFile";
import { fmtCount } from "../../platform/format";
import type { ToolComponentProps } from "../../platform/types";
import { CSV_BOM, extractJson } from "./extract";

const JSON_LANG = () => import("@codemirror/lang-json").then((m) => m.json());

function parseCols(raw: unknown): string[] {
  try {
    const parsed: unknown = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

/**
 * 异形布局（ADR-0003 逃逸）：输入 → 定位路径/选列控制条 → 输出（JSON/CSV 双预览）。
 * 提取是线性转换，实时同步计算。
 */
export function JsonExtract({
  input,
  onInput,
  settings,
  onSettingsChange,
  sample,
}: ToolComponentProps) {
  const path = String(settings.path ?? "");
  const selected = useMemo(() => parseCols(settings.cols), [settings.cols]);
  const valueArrayOn = settings.valueArray === true;
  const analysis = useMemo(
    () => extractJson(input, path, selected, valueArrayOn),
    [input, path, selected, valueArrayOn],
  );

  const [tab, setTab] = useState<"json" | "csv">("json");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(
    () => () => {
      clearTimeout(copiedTimer.current);
      clearTimeout(savedTimer.current);
    },
    [],
  );

  const setCols = (cols: string[]) => onSettingsChange({ cols: JSON.stringify(cols) });
  const toggleKey = (key: string) =>
    setCols(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  // 手输的、并集之外的 key 也渲染成 chip（勾选态可见），投影时缺失即为空
  const chips = useMemo(
    () => [...analysis.keys, ...selected.filter((k) => !analysis.keys.includes(k))],
    [analysis.keys, selected],
  );

  const output = tab === "json" ? analysis.json : analysis.csv;
  const hasOutput = output !== undefined && output !== "";
  const errorBanner = analysis.error ?? (analysis.pathError ? { message: analysis.pathError } : undefined);

  const doCopy = async () => {
    if (!hasOutput) return;
    await copyText(output);
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1200);
  };

  const doExport = async () => {
    if (!analysis.csv) return;
    const savedPath = await saveTextFile(CSV_BOM + analysis.csv, "json-extract.csv", [
      { name: "CSV（逗号分隔）", extensions: ["csv"] },
    ]);
    if (savedPath !== null) {
      setSaved(true);
      clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setSaved(false), 1200);
    }
  };

  const addDraft = () => {
    const key = draft.trim();
    if (key && !selected.includes(key)) setCols([...selected, key]);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 p-2">
      {/* 输入 */}
      <section className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-8 shrink-0 items-center gap-2 px-3">
          <span className="select-none text-2xs font-medium uppercase tracking-[0.08em] text-muted">
            输入
          </span>
          <span className="truncate text-2xs text-faint">{input ? fmtCount(input) : undefined}</span>
          <span className="ml-auto flex items-center gap-0.5">
            {sample && (
              <button
                className="icon-btn"
                title="载入示例（并填好定位路径）"
                onClick={() => {
                  onInput(sample);
                  onSettingsChange({ path: "data.list" });
                }}
              >
                <Sparkles size={13} />
              </button>
            )}
            <PasteButton onPaste={onInput} />
            <button className="icon-btn" title="清空" disabled={!input} onClick={() => onInput("")}>
              <Eraser size={13} />
            </button>
          </span>
        </header>
        <div className="min-h-0 flex-1">
          <CodeEditor
            value={input}
            onChange={onInput}
            language={JSON_LANG}
            placeholder="粘贴 JSON：对象数组，或用下方定位路径圈出数组…"
          />
        </div>
      </section>

      {/* 定位路径 + 选列 */}
      <div className="card shrink-0 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="shrink-0 select-none text-2xs font-medium uppercase tracking-[0.08em] text-muted">
            定位路径
          </span>
          <input
            value={path}
            onChange={(e) => onSettingsChange({ path: e.target.value })}
            placeholder="如 data.list（点路径 + [0] 下标；留空 = 直接对输入投影）"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-text outline-none placeholder:text-faint"
          />
          <button
            onClick={() => onSettingsChange({ valueArray: !valueArrayOn })}
            title="只勾选一列时，输出该列的值数组（如 [1,2,3]）而非对象数组；CSV 相应为单列"
            className={`pressable shrink-0 rounded-md px-1.5 py-0.5 text-2xs ${
              valueArrayOn ? "bg-active text-accent" : "bg-raise text-muted hover:text-text"
            }`}
          >
            值数组
          </button>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="shrink-0 select-none text-2xs text-muted">列</span>
          {chips.length === 0 && !adding && (
            <span className="text-2xs text-faint">
              {errorBanner ? "—" : "解析出 key 后出现在这里"}
            </span>
          )}
          {chips.map((key) => (
            <button
              key={key}
              title={selected.includes(key) ? "取消勾选" : "勾选提取"}
              onClick={() => toggleKey(key)}
              className={`pressable rounded-md px-1.5 py-0.5 font-mono text-2xs ${
                selected.includes(key) ? "bg-active text-accent" : "bg-raise text-muted hover:text-text"
              }`}
            >
              {key}
            </button>
          ))}
          {adding ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addDraft();
                if (e.key === "Escape") {
                  setDraft("");
                  setAdding(false);
                }
              }}
              onBlur={addDraft}
              placeholder="key，回车添加"
              spellCheck={false}
              className="w-36 rounded-md bg-raise px-1.5 py-0.5 font-mono text-2xs text-text outline-none placeholder:text-faint"
            />
          ) : (
            <button
              className="pressable flex items-center gap-0.5 rounded-md bg-raise px-1.5 py-0.5 text-2xs text-muted hover:text-text"
              title="手动添加并集之外的 key"
              onClick={() => setAdding(true)}
            >
              <Plus size={10} />
              添加
            </button>
          )}
          <span className="ml-auto flex shrink-0 items-center gap-2">
            <button
              className="pressable text-2xs text-accent disabled:opacity-35"
              disabled={analysis.keys.length === 0}
              onClick={() => setCols(analysis.keys)}
            >
              全选
            </button>
            <button
              className="pressable text-2xs text-muted disabled:opacity-35"
              disabled={selected.length === 0}
              onClick={() => setCols([])}
            >
              清空
            </button>
          </span>
        </div>
      </div>

      {errorBanner && (
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-danger/25 bg-danger/8 px-2.5 py-1.5 text-xs text-danger">
          <TriangleAlert size={13} className="shrink-0" />
          <span className="break-all">{errorBanner.message}</span>
        </div>
      )}

      {/* 输出：JSON / CSV 双预览 */}
      <section className="card flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-8 shrink-0 items-center gap-2 px-3">
          <span className="select-none text-2xs font-medium uppercase tracking-[0.08em] text-muted">
            输出
          </span>
          <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-raise p-0.5">
            {(["json", "csv"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`pressable rounded px-2 py-0.5 text-2xs uppercase ${
                  tab === t ? "bg-active text-accent" : "text-muted hover:text-text"
                }`}
              >
                {t}
              </button>
            ))}
          </span>
          <span
            className={`truncate text-2xs ${valueArrayOn && selected.length !== 1 ? "text-warn" : "text-faint"}`}
          >
            {valueArrayOn && selected.length !== 1
              ? "值数组模式需恰好勾选一列"
              : tab === "csv" && analysis.csv !== undefined && analysis.columns
                ? `${analysis.rowCount ?? 0} 行 × ${analysis.columns.length} 列 · 导出自动加 BOM（Excel 兼容）`
                : selected.length === 0 && !errorBanner
                  ? "勾选要提取的列"
                  : undefined}
          </span>
          <span className="ml-auto flex items-center gap-0.5">
            <button
              className="icon-btn"
              title={copied ? "已复制" : "复制输出"}
              disabled={!hasOutput}
              onClick={doCopy}
            >
              {copied ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
            </button>
            {tab === "csv" && (
              <button
                className="icon-btn"
                title={saved ? "已保存" : "导出 CSV 文件（另存为）"}
                disabled={!analysis.csv}
                onClick={doExport}
              >
                {saved ? <Check size={13} className="text-ok" /> : <ArrowDownToLine size={13} />}
              </button>
            )}
          </span>
        </header>
        <div className="min-h-0 flex-1">
          {tab === "csv" ? (
            analysis.csv && analysis.columns && analysis.rows ? (
              <CsvTable columns={analysis.columns} rows={analysis.rows} />
            ) : (
              <p className="px-3 py-3 text-xs text-faint">
                {errorBanner ? "修正错误后这里显示表格" : "勾选要提取的列后这里显示表格"}
              </p>
            )
          ) : (
            <CodeEditor
              value={output ?? ""}
              readOnly
              language={JSON_LANG}
              placeholder={errorBanner ? "修正错误后这里显示提取结果" : "投影结果（JSON）"}
            />
          )}
        </div>
      </section>
    </div>
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

/** CSV 页签的表格预览：粘性表头 + 行号；单元格超长截断，悬浮/复制看全文 */
const CSV_PREVIEW_LIMIT = 500;

function CsvTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  const capped = rows.length > CSV_PREVIEW_LIMIT;
  const shown = capped ? rows.slice(0, CSV_PREVIEW_LIMIT) : rows;
  return (
    <div className="min-h-0 flex-1 select-text overflow-auto">
      {/* border-separate 让粘性表头的下边框在滚动时不消失 */}
      <table className="w-full border-separate border-spacing-0 text-left">
        <thead>
          <tr>
            <th className="sticky top-0 z-10 border-b border-line/60 bg-panel px-2.5 py-1 text-right text-2xs font-medium text-faint">
              #
            </th>
            {columns.map((column) => (
              <th
                key={column}
                title={column}
                className="sticky top-0 z-10 border-b border-line/60 bg-panel px-2.5 py-1 font-mono text-2xs font-medium text-muted"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i} className="hover:bg-hover">
              <td className="border-b border-line/40 px-2.5 py-1 text-right font-mono text-2xs text-faint">
                {i + 1}
              </td>
              {row.map((cell, j) => (
                <td
                  key={j}
                  title={cell}
                  className="max-w-60 truncate border-b border-line/40 px-2.5 py-1 font-mono text-xs text-text"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {capped && (
        <p className="px-2.5 py-1.5 text-2xs text-faint">
          预览前 {CSV_PREVIEW_LIMIT} 行（共 {rows.length} 行），导出包含全部
        </p>
      )}
    </div>
  );
}
