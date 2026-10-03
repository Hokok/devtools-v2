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
    <div className="flex h-full flex-col items-center justify-center gap-7">
      <div className="flex flex-col items-center gap-4">
        <LogoMark size={44} />
        <div className="text-center">
          <div className="text-lg font-semibold tracking-[0.3em] text-text">DEVTOOLS</div>
          <div className="mt-2 text-sm text-faint">开发者的随身工作台 · 打开即用，用完即走</div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {quick.map((tool) => {
          const Icon = tool.meta.icon;
          return (
            <button
              key={tool.meta.id}
              onClick={() => openTool(tool.meta.id)}
              className="pressable flex items-center gap-2 rounded-full border border-card-border bg-panel py-2 pr-4 pl-3.5 text-xs text-muted shadow-[var(--card-shadow)] hover:text-text"
            >
              <Icon size={14} />
              {tool.meta.name}
            </button>
          );
        })}
      </div>

      <button
        className="flex items-center gap-1.5 text-xs text-faint transition-colors hover:text-muted"
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

/** 品牌标记：与 app-icon 同母题同几何（scripts/make-icon.py）的蓝底白「❯_」 */
export function LogoMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" className="shrink-0" aria-hidden="true">
      <defs>
        <linearGradient id="dt-logo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5aa5fc" />
          <stop offset="1" stopColor="#1a5ccd" />
        </linearGradient>
        <linearGradient id="dt-logo-glyph" x1="0" y1="313" x2="0" y2="719" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d6e6fa" />
        </linearGradient>
        <clipPath id="dt-logo-clip">
          <rect width="1024" height="1024" rx="235" />
        </clipPath>
        <filter id="dt-logo-shadow" x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="26" stdDeviation="20" floodColor="#082260" floodOpacity="0.45" />
        </filter>
      </defs>
      <rect width="1024" height="1024" rx="235" fill="url(#dt-logo-bg)" />
      {/* 边缘压暗勾体积（裁回圆角内，只显示内半段） */}
      <g clipPath="url(#dt-logo-clip)">
        <rect
          x="-35"
          y="-35"
          width="1094"
          height="1094"
          rx="270"
          fill="none"
          stroke="#082260"
          strokeOpacity="0.32"
          strokeWidth="70"
        />
      </g>
      <g filter="url(#dt-logo-shadow)">
        <polyline
          points="268,313 512,516 268,719"
          fill="none"
          stroke="url(#dt-logo-glyph)"
          strokeWidth="74"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <line
          x1="576"
          y1="719"
          x2="756"
          y2="719"
          stroke="url(#dt-logo-glyph)"
          strokeWidth="74"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
