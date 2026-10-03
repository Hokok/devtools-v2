import { LoaderCircle, RotateCcw, TriangleAlert } from "lucide-react";
import { useLoadedTool, useToolSettings } from "../platform/hooks";
import { useTabs, type Tab } from "../platform/stores/tabs";
import { LayoutTemplate } from "./LayoutTemplate";

/**
 * 单个 Tab 的内容装配点：
 * - 工具提供 Component → 异形布局，整体覆盖模板（ADR-0003）
 * - 否则 → 布局模板 + transform
 *
 * 保活：挂载期间用 display:none 切换，不卸载 DOM；
 * 是否挂载由 shouldMount（LRU 预算）决定，输入内容始终在 store 中。
 */
export function TabSurface({ tab, active }: { tab: Tab; active: boolean }) {
  const { tool, error, retry } = useLoadedTool(tab.toolId);
  const { settings, update } = useToolSettings(tool);
  const setInput = useTabs((s) => s.setInput);

  let body: React.ReactNode;
  if (error) {
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <TriangleAlert size={20} className="text-danger" />
        <p className="max-w-80 text-center text-xs leading-5 text-muted">
          工具加载失败：{error}
        </p>
        <button
          onClick={retry}
          className="pressable flex items-center gap-1.5 rounded-md border border-line bg-panel px-3 py-1.5 text-xs text-muted hover:border-accent-dim hover:text-accent"
        >
          <RotateCcw size={12} />
          重试
        </button>
      </div>
    );
  } else if (!tool) {
    body = (
      <div className="flex h-full items-center justify-center gap-2 text-muted">
        <LoaderCircle size={15} className="animate-spin text-accent" />
        <span className="text-xs">加载工具…</span>
      </div>
    );
  } else if (tool.Component) {
    const Component = tool.Component;
    body = (
      <Component
        input={tab.input}
        onInput={(value) => setInput(tab.id, value)}
        settings={settings}
        onSettingsChange={update}
        sample={tool.sample}
      />
    );
  } else {
    body = (
      <LayoutTemplate
        tool={tool}
        input={tab.input}
        onInput={(value) => setInput(tab.id, value)}
        settings={settings}
      />
    );
  }

  return (
    // contain: 布局/绘制隔离——缩放窗口时重排失效不外溢，减轻逐帧重排的走位感
    <div className={active ? "absolute inset-0 flex flex-col [contain:layout_paint]" : "hidden"}>
      {body}
    </div>
  );
}
