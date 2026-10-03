import { ClipboardPaste, Eraser, LoaderCircle, Sparkles, TriangleAlert } from "lucide-react";
import { CodeEditor } from "../../editor/CodeEditor";
import { readText } from "../../platform/clipboard";
import { useRegexMatches } from "../../platform/useRegexMatches";
import type { ToolComponentProps } from "../../platform/types";
import { texts as T } from "./texts";

const FLAG_ITEMS: { flag: string; label: string; hint: string }[] = [
  { flag: "g", label: "全局", hint: "global：找出所有匹配" },
  { flag: "i", label: "忽略大小写", hint: "ignore case" },
  { flag: "m", label: "多行", hint: "multiline：^ $ 匹配行首行尾" },
  { flag: "s", label: "dotAll", hint: ". 也匹配换行符" },
  { flag: "u", label: "Unicode", hint: "unicode 模式" },
];

/**
 * 异形布局（ADR-0003 逃逸）：模式栏 + 左编辑器右匹配列表。
 * 匹配计算走专用 Worker 并有 2s 超时保护——病态正则不会卡死界面。
 */
export function RegexTester({ input, onInput, settings, onSettingsChange, sample }: ToolComponentProps) {
  const pattern = String(settings.pattern ?? "");
  const flags = String(settings.flags ?? "g");
  const { matches, error, running } = useRegexMatches(pattern, flags, input);

  const toggleFlag = (flag: string) => {
    const next = flags.includes(flag) ? flags.replace(flag, "") : flags + flag;
    onSettingsChange({ flags: next });
  };

  const status = running ? (
    <span className="flex items-center gap-1 text-muted">
      <LoaderCircle size={11} className="animate-spin" />
      匹配中…
    </span>
  ) : pattern ? (
    matches.length > 0 ? (
      T.matchCount(matches.length)
    ) : (
      T.noMatch
    )
  ) : (
    T.emptyPattern
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-1 p-2">
      {/* 模式栏 */}
      <div className="card flex h-9 shrink-0 items-center gap-1.5 px-3">
        <span className="select-none font-mono text-sm text-accent">/</span>
        <input
          value={pattern}
          onChange={(e) => onSettingsChange({ pattern: e.target.value })}
          placeholder="正则表达式，如 (?<user>\\w+)@"
          spellCheck={false}
          className="min-w-0 flex-1 bg-transparent font-mono text-sm text-text outline-none placeholder:text-faint"
        />
        <span className="select-none font-mono text-sm text-accent">/{flags}</span>
        <span className="mx-1 h-4 w-px bg-line/70" />
        {FLAG_ITEMS.map((f) => (
          <button
            key={f.flag}
            title={f.hint}
            onClick={() => toggleFlag(f.flag)}
            className={`pressable flex h-6 w-6 items-center justify-center rounded-md font-mono text-2xs ${
              flags.includes(f.flag)
                ? "bg-active text-accent"
                : "text-faint hover:bg-hover hover:text-muted"
            }`}
          >
            {f.flag}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-danger/25 bg-danger/8 px-2.5 py-1.5 text-xs text-danger">
          <TriangleAlert size={13} className="shrink-0" />
          <span className="break-all">
            {error.startsWith("执行超过") ? error : `${T.invalid}：${error}`}
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-2">
        {/* 测试文本 */}
        <section className="card flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-8 shrink-0 items-center gap-2 px-3">
            <span className="text-2xs font-medium tracking-[0.08em] text-muted uppercase">
              测试文本
            </span>
            <span className="ml-auto text-2xs text-faint">{status}</span>
            <span className="flex items-center gap-0.5">
              {sample && (
                <button className="icon-btn" title="载入示例" onClick={() => onInput(sample)}>
                  <Sparkles size={13} />
                </button>
              )}
              <button
                className="icon-btn"
                title="粘贴"
                onClick={async () => {
                  try {
                    const text = await readText();
                    if (text) onInput(text);
                  } catch {
                    /* 无剪贴板权限时静默 */
                  }
                }}
              >
                <ClipboardPaste size={13} />
              </button>
              <button className="icon-btn" title="清空" disabled={!input} onClick={() => onInput("")}>
                <Eraser size={13} />
              </button>
            </span>
          </header>
          <div className="min-h-0 flex-1">
            <CodeEditor value={input} onChange={onInput} placeholder="在此粘贴要测试的文本…" />
          </div>
        </section>

        {/* 匹配结果 */}
        <MatchList matches={matches} />
      </div>
    </div>
  );
}

function MatchList({ matches }: { matches: RegexMatchInfo[] }) {
  return (
    <section className="card hidden w-[232px] shrink-0 flex-col overflow-hidden md:flex">
      <header className="flex h-8 shrink-0 items-center px-3">
        <span className="text-2xs font-medium tracking-[0.08em] text-muted uppercase">匹配</span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {matches.length === 0 ? (
          <p className="px-3 py-4 text-xs text-faint">{T.noMatch}</p>
        ) : (
          matches.map((m, i) => (
            <div key={i} className="border-b border-line/60 px-2.5 py-1.5 text-xs">
              <div className="flex items-baseline gap-2">
                <span className="text-2xs text-faint">#{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-text">{m.text || "(空匹配)"}</span>
                <span className="shrink-0 text-2xs text-faint" title={T.index}>
                  @{m.index}
                </span>
              </div>
              {(m.groups.length > 0 || (m.named && Object.keys(m.named).length > 0)) && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-2xs text-muted">
                  {m.groups.map((g, gi) => (
                    <span key={gi}>
                      ${gi + 1}: <span className="text-ok">{g ?? "—"}</span>
                    </span>
                  ))}
                  {m.named &&
                    Object.entries(m.named).map(([name, g]) => (
                      <span key={name}>
                        ${"{"}
                        {name}
                        {"}"}: <span className="text-accent">{g ?? "—"}</span>
                      </span>
                    ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

type RegexMatchInfo = import("../../platform/regexTypes").RegexMatch;
