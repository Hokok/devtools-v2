import { PanelLeftClose, Settings } from "lucide-react";
import { registry } from "../platform/registry";
import { TOOL_GROUPS } from "../platform/types";
import { useTabs } from "../platform/stores/tabs";
import { useUi } from "../platform/stores/ui";
import { LogoMark } from "./EmptyState";

/** 左侧功能菜单：按分组陈列工具，可收缩至图标栏（开关在顶部，与右侧设置面板一致）。 */
export function SideNav() {
  const collapsed = useUi((s) => s.navCollapsed);
  const toggleNav = useUi((s) => s.toggleNav);
  const setGlobalSettingsOpen = useUi((s) => s.setGlobalSettingsOpen);
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const openTool = useTabs((s) => s.openTool);

  const activeToolId = tabs.find((t) => t.id === activeId)?.toolId;

  return (
    <aside
      className="z-10 flex shrink-0 flex-col transition-[width] duration-200 ease-out"
      style={{ width: collapsed ? 36 : 140 }}
    >
      {/* 品牌区 + 收缩开关（顶部，与右侧设置面板的开关位置对称）；
          收起时品牌标识本身即展开按钮——窄条里第一个可点元素就是「展开」，不用找 */}
      {collapsed ? (
        <div className="flex shrink-0 flex-col items-center py-1.5">
          <button
            className="pressable flex h-8 w-8 items-center justify-center rounded-md hover:bg-hover"
            title="展开菜单"
            onClick={toggleNav}
          >
            <LogoMark />
          </button>
        </div>
      ) : (
        <div className="flex h-10 shrink-0 items-center gap-2 pl-2.5 pr-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <LogoMark />
            <span className="truncate text-md font-semibold tracking-tight text-text select-none">
              DevTools
            </span>
          </div>
          <button className="icon-btn shrink-0" title="收缩菜单" onClick={toggleNav}>
            <PanelLeftClose size={15} />
          </button>
        </div>
      )}

      <nav className="min-h-0 flex-1 overflow-y-auto px-1.5 py-1">
        {TOOL_GROUPS.map((group) => {
          const tools = registry.filter((t) => t.meta.group === group.id);
          if (tools.length === 0) return null;
          return (
            <div key={group.id} className="mb-1.5">
              {!collapsed && (
                <div className="px-2 pt-1.5 pb-1 text-xs font-medium tracking-[0.08em] text-faint uppercase">
                  {group.name}
                </div>
              )}
              {collapsed && <div className="mx-2 my-1.5 border-t border-line/60" />}
              {tools.map((tool) => {
                const Icon = tool.meta.icon;
                const active = tool.meta.id === activeToolId;
                return (
                  <button
                    key={tool.meta.id}
                    title={collapsed ? tool.meta.name : undefined}
                    onClick={() => openTool(tool.meta.id)}
                    className={[
                      "group flex h-7 w-full items-center gap-2 rounded-md text-left text-md transition-colors",
                      collapsed ? "justify-center" : "px-2",
                      active
                        ? "bg-active text-accent"
                        : "text-muted hover:bg-hover hover:text-text",
                    ].join(" ")}
                  >
                    <Icon size={14} className={active ? "text-accent" : "text-faint group-hover:text-muted"} />
                    {!collapsed && <span className="truncate">{tool.meta.name}</span>}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* 底部只留全局设置入口（命令面板走 Ctrl/Cmd+K，主题切换在设置弹窗与命令面板） */}
      <div className="flex shrink-0 items-center p-1.5">
        <button
          className="icon-btn"
          title="全局设置 (Ctrl/Cmd+,)"
          onClick={() => setGlobalSettingsOpen(true)}
        >
          <Settings size={14} />
        </button>
      </div>
    </aside>
  );
}
