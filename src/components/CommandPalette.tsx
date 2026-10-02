import { useEffect, useMemo, useRef, useState } from "react";
import { CornerDownLeft, Search } from "lucide-react";
import { fuzzyScore } from "../platform/fuzzy";
import { registry } from "../platform/registry";
import { TOOL_GROUPS } from "../platform/types";
import { useTabs } from "../platform/stores/tabs";
import { useUi } from "../platform/stores/ui";

const groupName = (id: string) => TOOL_GROUPS.find((g) => g.id === id)?.name ?? "";

/** 命令面板：Ctrl/Cmd+K 直达工具，基于注册表元信息模糊检索。 */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const openTool = useTabs((s) => s.openTool);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    const scored = registry
      .map((tool) => {
        const scores = [
          fuzzyScore(query, tool.meta.name) ?? -Infinity,
          ...(tool.meta.keywords ?? []).map((k) => (fuzzyScore(query, k) ?? -Infinity) * 0.92),
          (fuzzyScore(query, tool.meta.id) ?? -Infinity) * 0.8,
        ];
        return { tool, score: Math.max(...scores) };
      })
      .filter((r) => r.score > -Infinity)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
    return scored.map((r) => r.tool);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  if (!open) return null;

  const commit = (index: number) => {
    const tool = results[index];
    if (tool) {
      openTool(tool.meta.id);
      setOpen(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[2px]"
      onMouseDown={() => setOpen(false)}
      onKeyDown={(e) => {
        // 中文输入法组合期间（选词回车/取消 Esc）不拦截按键
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setCursor((c) => Math.min(c + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setCursor((c) => Math.max(c - 1, 0));
        } else if (e.key === "Enter") {
          e.preventDefault();
          commit(cursor);
        } else if (e.key === "Escape") {
          setOpen(false);
        }
      }}
    >
      <div
        className="mx-auto mt-[12vh] w-[560px] max-w-[90vw] overflow-hidden rounded-xl border border-line-strong bg-panel shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ animation: "palette-pop 120ms ease-out" }}
      >
        <div className="flex items-center gap-2.5 border-b border-line px-4">
          <Search size={15} className="shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder="搜索工具…"
            className="h-12 w-full bg-transparent text-sm text-text outline-none placeholder:text-faint"
          />
          <span className="kbd shrink-0">ESC</span>
        </div>

        <ul className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-faint">没有匹配的工具</li>
          )}
          {results.map((tool, i) => {
            const Icon = tool.meta.icon;
            const selected = i === cursor;
            return (
              <li key={tool.meta.id}>
                <button
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => commit(i)}
                  className={[
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    selected ? "bg-active" : "",
                  ].join(" ")}
                >
                  <Icon size={16} className={selected ? "text-accent" : "text-faint"} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-xs ${selected ? "text-text" : "text-muted"}`}>
                      {tool.meta.name}
                    </span>
                    <span className="block truncate text-[10px] text-faint">{tool.meta.description}</span>
                  </span>
                  <span className="shrink-0 text-[10px] text-faint">{groupName(tool.meta.group)}</span>
                  {selected && <CornerDownLeft size={12} className="shrink-0 text-accent" />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <style>{`@keyframes palette-pop { from { opacity: 0; transform: translateY(-4px) scale(0.985); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
