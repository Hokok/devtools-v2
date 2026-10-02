import { useRef } from "react";
import { PanelRightClose, PanelRightOpen, X } from "lucide-react";
import { useTabs } from "../platform/stores/tabs";
import { useUi } from "../platform/stores/ui";
import { getTool } from "../platform/registry";

/** Chrome 式 Tab 栏：可多开、中键关闭、拖拽排序（拖拽在 MVP 后补充）。 */
export function TabBar() {
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const activate = useTabs((s) => s.activate);
  const closeTab = useTabs((s) => s.closeTab);
  const settingsOpen = useUi((s) => s.settingsOpen);
  const toggleSettings = useUi((s) => s.toggleSettings);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 同工具多开时给标题加序号，便于区分
  const instanceNo = (toolId: string, tabId: string) => {
    const siblings = tabs.filter((t) => t.toolId === toolId);
    return siblings.length > 1 ? siblings.findIndex((t) => t.id === tabId) + 1 : undefined;
  };

  return (
    <div className="flex h-10 shrink-0 items-center border-b border-line bg-bg pr-2 pl-1.5">
      <div
        ref={scrollRef}
        className="scrollbar-none flex min-w-0 flex-1 items-center gap-1 overflow-x-auto"
        onWheel={(e) => {
          // 触控板纵滚转横向滚动，Tab 多时不用去够底部的细滚动条
          if (e.deltaY !== 0 && scrollRef.current) {
            scrollRef.current.scrollLeft += e.deltaY;
          }
        }}
      >
        {tabs.map((tab) => {
          const tool = getTool(tab.toolId);
          const Icon = tool?.meta.icon;
          const no = instanceNo(tab.toolId, tab.id);
          const active = tab.id === activeId;
          return (
            <button
              key={tab.id}
              onClick={() => activate(tab.id)}
              onMouseDown={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  closeTab(tab.id);
                }
              }}
              title={tool?.meta.description}
              className={[
                "group flex h-[27px] shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors",
                active
                  ? "border-line-strong bg-panel text-text"
                  : "border-transparent text-muted hover:bg-hover hover:text-text",
              ].join(" ")}
            >
              {Icon && <Icon size={13} className={active ? "text-accent" : "text-faint"} />}
              <span className="max-w-44 truncate">
                {tool?.meta.name}
                {no ? <span className="ml-1 text-faint">{no}</span> : null}
              </span>
              <span
                role="button"
                aria-label="关闭"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={[
                  "ml-0.5 flex h-4 w-4 items-center justify-center rounded-sm text-faint transition-all",
                  active ? "opacity-60 hover:bg-hover hover:text-text" : "opacity-0 group-hover:opacity-60 hover:!opacity-100",
                ].join(" ")}
              >
                <X size={11} />
              </span>
            </button>
          );
        })}
      </div>

      <button
        className="icon-btn h-7 w-7"
        title={settingsOpen ? "收起设置面板" : "打开设置面板"}
        onClick={toggleSettings}
      >
        {settingsOpen ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
      </button>
    </div>
  );
}
