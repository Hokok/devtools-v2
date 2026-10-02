import { ChevronsLeft, ChevronsRight, Moon, Search, Sun } from "lucide-react";
import { registry } from "../platform/registry";
import { TOOL_GROUPS } from "../platform/types";
import { useTabs } from "../platform/stores/tabs";
import { useUi } from "../platform/stores/ui";
import { LogoMark } from "./EmptyState";

/** 左侧功能菜单：按分组陈列工具，可收缩至图标栏（开关在顶部，与右侧设置面板一致）。 */
export function SideNav() {
  const collapsed = useUi((s) => s.navCollapsed);
  const toggleNav = useUi((s) => s.toggleNav);
  const theme = useUi((s) => s.theme);
  const toggleTheme = useUi((s) => s.toggleTheme);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const openTool = useTabs((s) => s.openTool);

  const activeToolId = tabs.find((t) => t.id === activeId)?.toolId;

  return (
    <aside
      className="z-10 flex shrink-0 flex-col border-r border-line bg-panel transition-[width] duration-200 ease-out"
      style={{ width: collapsed ? 52 : 208 }}
    >
      {/* 品牌区 + 收缩开关（顶部，与右侧设置面板的开关位置对称） */}
      <div className={`shrink-0 border-b border-line ${collapsed ? "flex flex-col items-center gap-1 py-2.5" : "flex h-12 items-center gap-2.5 pl-3.5 pr-2"}`}>
        <div className={`flex items-center gap-2.5 ${collapsed ? "" : "min-w-0"}`}>
          <LogoMark />
          {!collapsed && (
            <span className="truncate text-[13px] font-semibold tracking-[0.22em] text-text select-none">
              DEVTOOLS
            </span>
          )}
        </div>
        <button
          className="icon-btn h-7 w-7 shrink-0"
          title={collapsed ? "展开菜单" : "收缩菜单"}
          onClick={toggleNav}
        >
          {collapsed ? <ChevronsRight size={14} /> : <ChevronsLeft size={14} />}
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto py-2">
        {TOOL_GROUPS.map((group) => {
          const tools = registry.filter((t) => t.meta.group === group.id);
          if (tools.length === 0) return null;
          return (
            <div key={group.id} className="mb-1.5">
              {!collapsed && (
                <div className="px-4 pt-2 pb-1 text-[10px] tracking-[0.16em] text-faint uppercase">
                  {group.name}
                </div>
              )}
              {collapsed && <div className="mx-3 my-2 border-t border-line" />}
              {tools.map((tool) => {
                const Icon = tool.meta.icon;
                const active = tool.meta.id === activeToolId;
                return (
                  <button
                    key={tool.meta.id}
                    title={collapsed ? tool.meta.name : undefined}
                    onClick={() => openTool(tool.meta.id)}
                    className={[
                      "group relative flex h-[30px] w-full items-center gap-2.5 text-left text-xs transition-colors",
                      collapsed ? "justify-center" : "px-3.5",
                      active
                        ? "bg-active text-accent"
                        : "text-muted hover:bg-hover hover:text-text",
                    ].join(" ")}
                  >
                    {active && (
                      <span className="absolute top-1.5 bottom-1.5 left-0 w-[2px] rounded-r bg-accent" />
                    )}
                    <Icon size={15} className={active ? "text-accent" : "text-faint group-hover:text-muted"} />
                    {!collapsed && <span className="truncate">{tool.meta.name}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className={`flex shrink-0 items-center border-t border-line p-2 ${collapsed ? "flex-col gap-1" : "justify-between"}`}>
        <button
          className="icon-btn h-7 w-7"
          title="命令面板 (Ctrl/Cmd+K)"
          onClick={() => setPaletteOpen(true)}
        >
          <Search size={14} />
        </button>
        <button
          className="icon-btn h-7 w-7"
          title={theme === "dark" ? "切换到浅色主题" : "切换到深色主题"}
          onClick={toggleTheme}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
        </button>
      </div>
    </aside>
  );
}
