import type { LucideIcon } from "lucide-react";
import { Columns2, Rows2 } from "lucide-react";
import { useUi } from "../platform/stores/ui";
import type { LayoutDirection, ThemeMode } from "../platform/stores/ui";
import { useUpdater, checkForUpdateManually } from "../platform/stores/updater";

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
  const autoCopyOutput = useUi((s) => s.autoCopyOutput);
  const setAutoCopyOutput = useUi((s) => s.setAutoCopyOutput);
  const close = () => useUi.setState({ globalSettingsOpen: false });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay)] backdrop-blur-[3px]"
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
        className="card w-[420px] max-w-[90vw] rounded-2xl p-5 shadow-[var(--shadow-dialog)]"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ animation: "palette-pop 120ms ease-out" }}
      >
        <h2 className="text-base font-semibold text-text">全局设置</h2>
        <p className="mt-1 text-xs text-faint">作用于整个应用，即改即存、跨重启保留。</p>

        <section className="mt-5">
          <h3 className="text-2xs font-medium tracking-[0.08em] text-muted uppercase">外观</h3>
          <Segmented<ThemeMode>
            value={themeMode}
            onChange={setThemeMode}
            options={[
              { value: "dark", label: "深色" },
              { value: "light", label: "浅色" },
              { value: "system", label: "跟随系统" },
            ]}
          />
          <p className="mt-2 text-2xs leading-4 text-faint">
            GitHub Primer 配色；跟随系统时随操作系统外观实时切换，深浅也可在命令面板（Ctrl/Cmd+K）一键互换。
          </p>
        </section>

        <section className="mt-5">
          <h3 className="text-2xs font-medium tracking-[0.08em] text-muted uppercase">工作区</h3>
          <Segmented<LayoutDirection>
            value={layoutDirection}
            onChange={setLayoutDirection}
            options={[
              { value: "vertical", label: "上下分栏", icon: Rows2 },
              { value: "horizontal", label: "左右分栏", icon: Columns2 },
            ]}
          />
          <p className="mt-2 text-2xs leading-4 text-faint">
            输入/输出区的排列方向，对所有工具生效；分栏比例仍按工具记忆。
          </p>
        </section>

        <section className="mt-5">
          <h3 className="text-2xs font-medium tracking-[0.08em] text-muted uppercase">输出</h3>
          <div
            className="mt-2 flex cursor-pointer items-start justify-between gap-3"
            onClick={() => setAutoCopyOutput(!autoCopyOutput)}
          >
            <span>
              <span className="block text-sm text-text">输出就绪即自动复制</span>
              <span className="mt-0.5 block text-2xs leading-4 text-faint">
                每次算出结果就写进系统剪贴板（模板型工具生效）；结果同时进入剪贴板历史。
              </span>
            </span>
            <button
              role="switch"
              aria-checked={autoCopyOutput}
              aria-label="输出就绪即自动复制"
              className={`mt-0.5 h-[18px] w-8 shrink-0 rounded-full transition-colors ${autoCopyOutput ? "bg-accent" : "border border-line-strong bg-raise"}`}
            >
              <span
                className={`pointer-events-none block h-3 w-3 rounded-full transition-all ${autoCopyOutput ? "ml-[17px] bg-white" : "ml-[3px] bg-faint"}`}
              />
            </button>
          </div>
        </section>

        <AboutSection />

        <div className="mt-5 flex justify-end">
          <button onClick={close} className="btn btn-primary">
            完成
          </button>
        </div>
      </div>
      <style>{`@keyframes palette-pop { from { opacity: 0; transform: translateY(-4px) scale(0.985); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}

/** 关于与更新：当前版本展示 + 手动检查入口。状态由 updater store 驱动，与新版本提示条共用。 */
function AboutSection() {
  const currentVersion = useUpdater((s) => s.currentVersion);
  const status = useUpdater((s) => s.status);
  const nextVersion = useUpdater((s) => s.nextVersion);
  const errorMessage = useUpdater((s) => s.errorMessage);
  const busy = status === "checking" || status === "downloading";

  let hint = "";
  if (status === "up-to-date") hint = "已是最新版本。";
  else if (status === "available") hint = `发现新版本 v${nextVersion}，可在提示条里安装。`;
  else if (status === "downloading") hint = "正在下载更新…";
  else if (status === "restart-ready") hint = `v${nextVersion} 已就绪，重启应用即生效。`;
  else if (status === "error") hint = `检查失败：${errorMessage}`;

  return (
    <section className="mt-5">
      <h3 className="text-2xs font-medium tracking-[0.08em] text-muted uppercase">关于</h3>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span>
          <span className="block text-sm text-text">DevTools{currentVersion ? ` v${currentVersion}` : ""}</span>
          <span className="mt-0.5 block text-2xs leading-4 text-faint">{hint || "检查是否有可用的新版本。"}</span>
        </span>
        <button className="btn btn-ghost shrink-0" disabled={busy} onClick={() => void checkForUpdateManually()}>
          {busy ? "检查中…" : "检查更新"}
        </button>
      </div>
    </section>
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
    <div role="radiogroup" className="mt-2 flex gap-1 rounded-xl bg-raise p-1">
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
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors",
              selected ? "bg-panel text-text shadow-[0_1px_3px_rgba(1,4,9,0.18)]" : "text-muted hover:text-text",
            ].join(" ")}
          >
            {Icon && <Icon size={13} className={selected ? "text-accent" : ""} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
