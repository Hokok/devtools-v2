import { shouldMount, useTabs } from "../platform/stores/tabs";
import { EmptyState } from "./EmptyState";
import { TabSurface } from "./TabSurface";

/**
 * 工作区：渲染全部驻留 Tab（display:none 保活），切换零刷新。
 * 驻留预算 = 激活 Tab + 最近使用的 ≤20 个；超出的 Tab 只保留头部与输入。
 */
export function ToolHost() {
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);

  return (
    <div className="relative min-h-0 flex-1">
      {tabs.map((tab) =>
        shouldMount(tab, activeId, tabs) ? (
          <TabSurface key={tab.id} tab={tab} active={tab.id === activeId} />
        ) : null,
      )}
      {activeId === null && tabs.length === 0 && <EmptyState />}
    </div>
  );
}
