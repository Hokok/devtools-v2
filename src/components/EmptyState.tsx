import { ArrowRight, Command } from "lucide-react";
import { registry } from "../platform/registry";
import { useTabs } from "../platform/stores/tabs";
import { useUi } from "../platform/stores/ui";

/** 无 Tab 时的欢迎页：第一次打开应用与关闭所有 Tab 后看到的面貌。 */
export function EmptyState() {
  const openTool = useTabs((s) => s.openTool);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);

  const quick = ["json-formatter", "base64", "timestamp"]
    .map((id) => registry.find((t) => t.meta.id === id))
    .filter((t) => t !== undefined);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="flex flex-col items-center gap-3">
        <LogoMark size={40} />
        <div className="text-center">
          <div className="text-sm font-medium tracking-[0.3em] text-text">DEVTOOLS</div>
          <div className="mt-1.5 text-xs text-faint">开发者的随身工作台 · 打开即用，用完即走</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {quick.map((tool) => {
          const Icon = tool.meta.icon;
          return (
            <button
              key={tool.meta.id}
              onClick={() => openTool(tool.meta.id)}
              className="flex items-center gap-1.5 rounded-md border border-line bg-panel px-3 py-1.5 text-xs text-muted transition-colors hover:border-accent-dim hover:text-accent"
            >
              <Icon size={13} />
              {tool.meta.name}
            </button>
          );
        })}
      </div>

      <button
        className="flex items-center gap-1.5 text-[11px] text-faint transition-colors hover:text-muted"
        onClick={() => setPaletteOpen(true)}
      >
        <span>按</span>
        <span className="kbd">
          <Command size={9} className="mb-px inline" /> K
        </span>
        <span>打开命令面板，或从左侧选择工具</span>
        <ArrowRight size={11} className="text-faint" />
      </button>
    </div>
  );
}

/** 品牌标记：与 app-icon 同母题的「❯」终端提示符 */
export function LogoMark({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-[4px] border border-accent/60 bg-accent/10 text-accent"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        lineHeight: 1,
        boxShadow: "0 0 12px color-mix(in oklab, var(--accent) 25%, transparent)",
      }}
    >
      ❯
    </span>
  );
}
