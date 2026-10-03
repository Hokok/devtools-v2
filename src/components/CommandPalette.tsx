import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Columns2, CornerDownLeft, Search, Settings, SunMoon } from "lucide-react";
import { fuzzyScore } from "../platform/fuzzy";
import { registry } from "../platform/registry";
import { TOOL_GROUPS } from "../platform/types";
import { useTabs } from "../platform/stores/tabs";
import { useUi } from "../platform/stores/ui";

const groupName = (id: string) => TOOL_GROUPS.find((g) => g.id === id)?.name ?? "";

/** 面板可直达的全局命令（action），与工具检索混排、同一套模糊打分。 */
interface PaletteAction {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  icon: LucideIcon;
  run: () => void;
}

const ACTIONS: PaletteAction[] = [
  {
    id: "open-global-settings",
    name: "打开全局设置",
    description: "外观模式与工作区布局方向",
    keywords: ["设置", "偏好", "主题", "外观", "布局", "settings"],
    icon: Settings,
    run: () => useUi.getState().setGlobalSettingsOpen(true),
  },
  {
    id: "toggle-theme",
    name: "切换深浅主题",
    description: "在深色与浅色外观之间切换",
    keywords: ["深色", "浅色", "暗色", "亮色", "主题", "theme"],
    icon: SunMoon,
    run: () => useUi.getState().toggleTheme(),
  },
  {
    id: "toggle-layout-direction",
    name: "切换布局方向",
    description: "输入/输出区在上下分栏与左右分栏间互换",
    keywords: ["布局", "分栏", "方向", "layout"],
    icon: Columns2,
    run: () => useUi.getState().toggleLayoutDirection(),
  },
];

type Entry =
  | { kind: "tool"; score: number; tool: (typeof registry)[number] }
  | { kind: "action"; score: number; action: PaletteAction };

/** 命令面板：Ctrl/Cmd+K 直达工具与全局命令，基于元信息模糊检索。 */
export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const openTool = useTabs((s) => s.openTool);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<Entry[]>(() => {
    const toolEntries: Entry[] = registry.map((tool) => {
      const scores = [
        fuzzyScore(query, tool.meta.name) ?? -Infinity,
        ...(tool.meta.keywords ?? []).map((k) => (fuzzyScore(query, k) ?? -Infinity) * 0.92),
        (fuzzyScore(query, tool.meta.id) ?? -Infinity) * 0.8,
      ];
      return { kind: "tool", tool, score: Math.max(...scores) };
    });
    const actionEntries: Entry[] = ACTIONS.map((action) => {
      const scores = [
        fuzzyScore(query, action.name) ?? -Infinity,
        ...action.keywords.map((k) => (fuzzyScore(query, k) ?? -Infinity) * 0.92),
        (fuzzyScore(query, action.id) ?? -Infinity) * 0.8,
      ];
      return { kind: "action", action, score: Math.max(...scores) };
    });
    return [...toolEntries, ...actionEntries]
      .filter((r) => r.score > -Infinity)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);
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
    const entry = results[index];
    if (!entry) return;
    if (entry.kind === "tool") {
      openTool(entry.tool.meta.id);
    } else {
      entry.action.run();
    }
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[var(--overlay)] backdrop-blur-[3px]"
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
        className="card mx-auto mt-[12vh] w-[560px] max-w-[90vw] overflow-hidden rounded-2xl shadow-[var(--shadow-dialog)]"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ animation: "palette-pop 120ms ease-out" }}
      >
        <div className="flex items-center gap-3 border-b border-line/60 px-4">
          <Search size={15} className="shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            placeholder="搜索工具或命令…"
            className="h-11 w-full bg-transparent text-sm text-text outline-none placeholder:text-faint"
          />
          <span className="kbd shrink-0">ESC</span>
        </div>

        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-faint">没有匹配的工具或命令</li>
          )}
          {results.map((entry, i) => {
            const icon = entry.kind === "tool" ? entry.tool.meta.icon : entry.action.icon;
            const name = entry.kind === "tool" ? entry.tool.meta.name : entry.action.name;
            const description =
              entry.kind === "tool" ? entry.tool.meta.description : entry.action.description;
            const tag = entry.kind === "tool" ? groupName(entry.tool.meta.group) : "命令";
            const key = entry.kind === "tool" ? entry.tool.meta.id : entry.action.id;
            const Icon = icon;
            const selected = i === cursor;
            return (
              <li key={key}>
                <button
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => commit(i)}
                  className={[
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                    selected ? "bg-active" : "",
                  ].join(" ")}
                >
                  <Icon size={16} className={selected ? "text-accent" : "text-faint"} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm ${selected ? "text-text" : "text-muted"}`}>
                      {name}
                    </span>
                    <span className="block truncate text-2xs text-faint">{description}</span>
                  </span>
                  <span className="shrink-0 text-2xs text-faint">{tag}</span>
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
