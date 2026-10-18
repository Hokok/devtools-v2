import { PanelLeftClose, Settings, Star } from "lucide-react";
import { registry } from "../platform/registry";
import { TOOL_GROUPS } from "../platform/types";
import type { RegisteredTool } from "../platform/types";
import { useLibrary } from "../platform/stores/library";
import { useTabs } from "../platform/stores/tabs";
import { useUi } from "../platform/stores/ui";
import { LogoMark } from "./EmptyState";

/** 左侧功能菜单：收藏置顶 + 按分组陈列工具，可收缩至图标栏（开关在顶部，与右侧设置面板一致）。 */
export function SideNav() {
  const collapsed = useUi((s) => s.navCollapsed);
  const toggleNav = useUi((s) => s.toggleNav);
  const setGlobalSettingsOpen = useUi((s) => s.setGlobalSettingsOpen);
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const favorites = useLibrary((s) => s.favorites);

  const activeToolId = tabs.find((t) => t.id === activeId)?.toolId;
  const favoriteTools = favorites
    .map((id) => registry.find((t) => t.meta.id === id))
    .filter((t): t is RegisteredTool => Boolean(t));

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
        {/* 收藏（见 CONTEXT.md）：应用偏好、跨重启保留，置顶方便常驻工具 */}
        {favoriteTools.length > 0 && (
          <NavGroup title="收藏" collapsed={collapsed}>
            {favoriteTools.map((tool) => (
              <ToolRow key={tool.meta.id} tool={tool} collapsed={collapsed} active={tool.meta.id === activeToolId} />
            ))}
          </NavGroup>
        )}

        {TOOL_GROUPS.map((group) => {
          const tools = registry.filter((t) => t.meta.group === group.id);
          if (tools.length === 0) return null;
          return (
            <NavGroup key={group.id} title={group.name} collapsed={collapsed}>
              {tools.map((tool) => (
                <ToolRow
                  key={tool.meta.id}
                  tool={tool}
                  collapsed={collapsed}
                  active={tool.meta.id === activeToolId}
                />
              ))}
            </NavGroup>
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

function NavGroup({
  title,
  collapsed,
  children,
}: {
  title: string;
  collapsed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-1.5">
      {!collapsed && (
        <div className="px-2 pt-1.5 pb-1 text-xs font-medium tracking-[0.08em] text-faint uppercase">
          {title}
        </div>
      )}
      {collapsed && <div className="mx-2 my-1.5 border-t border-line/60" />}
      {children}
    </div>
  );
}

function ToolRow({
  tool,
  collapsed,
  active,
}: {
  tool: RegisteredTool;
  collapsed: boolean;
  active: boolean;
}) {
  const openTool = useTabs((s) => s.openTool);
  const toggleFavorite = useLibrary((s) => s.toggleFavorite);
  const favorited = useLibrary((s) => s.favorites.includes(tool.meta.id));
  const Icon = tool.meta.icon;

  return (
    <div className="group flex items-center">
      <button
        title={collapsed ? tool.meta.name : undefined}
        onClick={() => openTool(tool.meta.id)}
        className={[
          "flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md text-left text-md transition-colors",
          collapsed ? "justify-center" : "px-2",
          active ? "bg-active text-accent" : "text-muted hover:bg-hover hover:text-text",
        ].join(" ")}
      >
        <Icon size={14} className={active ? "text-accent" : "text-faint group-hover:text-muted"} />
        {!collapsed && <span className="truncate">{tool.meta.name}</span>}
      </button>
      {!collapsed && (
        <button
          className={[
            "flex h-6 w-5 shrink-0 items-center justify-center rounded-md transition-all",
            favorited ? "text-accent" : "text-faint opacity-0 group-hover:opacity-70 hover:!opacity-100",
          ].join(" ")}
          title={favorited ? "取消收藏" : "收藏"}
          aria-pressed={favorited}
          onClick={() => toggleFavorite(tool.meta.id)}
        >
          <Star size={12} className={favorited ? "fill-accent" : ""} />
        </button>
      )}
    </div>
  );
}
