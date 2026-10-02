import type { LucideIcon } from "lucide-react";
import { Columns2, Rows2 } from "lucide-react";
import { useUi } from "../platform/stores/ui";
import type { LayoutDirection, ThemeMode } from "../platform/stores/ui";

/**
 * 全局设置（独立于工具级设置面板）：外观模式三选一 + 工作区布局方向。
 * 所有选项即改即存（ui store 持久化），无"保存"按钮。
 */
export function GlobalSettingsDialog() {
  const open = useUi((s) => s.globalSettingsOpen);
  const themeMode = useUi((s) => s.themeMode);
  const setThemeMode = useUi((s) => s.setThemeMode);
  const layoutDirection = useUi((s) => s.layoutDirection);
  const setLayoutDirection = useUi((s) => s.setLayoutDirection);
  const close = () => useUi.setState({ globalSettingsOpen: false });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px]"
      onMouseDown={close}
      onKeyDown={(e) => {
        // 中文输入法组合期间不拦截按键；stopPropagation 防止 Esc 同时关掉工具级设置面板
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
    >
      <div
        role="dialog"
        aria-label="全局设置"
        className="w-[420px] max-w-[90vw] rounded-xl border border-line-strong bg-panel p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ animation: "palette-pop 120ms ease-out" }}
      >
        <h2 className="text-sm font-medium text-text">全局设置</h2>
        <p className="mt-1 text-xs text-faint">作用于整个应用，即改即存、跨重启保留。</p>

        <section className="mt-5">
          <h3 className="text-[10px] font-medium tracking-[0.18em] text-faint uppercase">外观</h3>
          <Segmented<ThemeMode>
            value={themeMode}
            onChange={setThemeMode}
            options={[
              { value: "dark", label: "深色" },
              { value: "light", label: "浅色" },
              { value: "system", label: "跟随系统" },
            ]}
          />
          <p className="mt-1.5 text-[10px] leading-4 text-faint">
            GitHub Primer 配色；跟随系统时随操作系统外观实时切换，侧栏日/月按钮可快捷切换深浅。
          </p>
        </section>

        <section className="mt-4">
          <h3 className="text-[10px] font-medium tracking-[0.18em] text-faint uppercase">工作区</h3>
          <Segmented<LayoutDirection>
            value={layoutDirection}
            onChange={setLayoutDirection}
            options={[
              { value: "vertical", label: "上下分栏", icon: Rows2 },
              { value: "horizontal", label: "左右分栏", icon: Columns2 },
            ]}
          />
          <p className="mt-1.5 text-[10px] leading-4 text-faint">
            输入/输出区的排列方向，对所有工具生效；分栏比例仍按工具记忆。
          </p>
        </section>

        <div className="mt-5 flex justify-end">
          <button
            onClick={close}
            className="rounded-md border border-line bg-raise px-3 py-1.5 text-xs text-text transition-colors hover:bg-hover"
          >
            完成
          </button>
        </div>
      </div>
      <style>{`@keyframes palette-pop { from { opacity: 0; transform: translateY(-4px) scale(0.985); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string; icon?: LucideIcon }>;
}) {
  return (
    <div role="radiogroup" className="mt-2 flex gap-1 rounded-lg border border-line bg-raise p-1">
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={[
              "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-colors",
              selected ? "bg-active text-accent" : "text-muted hover:bg-hover hover:text-text",
            ].join(" ")}
          >
            {Icon && <Icon size={13} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
