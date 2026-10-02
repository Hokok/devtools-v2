import { RotateCcw } from "lucide-react";
import { useLoadedTool, useToolSettings } from "../platform/hooks";
import { useTabs } from "../platform/stores/tabs";
import { useUi } from "../platform/stores/ui";
import type { SettingField, ToolSettings } from "../platform/types";

/**
 * 右侧设置抽屉：展示当前激活 Tab 所属工具的配置。
 * 字段由工具的 settingsSchema 声明，这里只做通用渲染——工具永不自己画表单。
 */
export function SettingsPanel() {
  const open = useUi((s) => s.settingsOpen);
  const tabs = useTabs((s) => s.tabs);
  const activeId = useTabs((s) => s.activeId);
  const activeToolId = tabs.find((t) => t.id === activeId)?.toolId ?? null;
  const { tool } = useLoadedTool(activeToolId);
  const { settings, update, reset } = useToolSettings(tool);

  return (
    <aside
      className="z-10 shrink-0 overflow-hidden border-l border-line bg-panel transition-[width] duration-200 ease-out"
      style={{ width: open ? 192 : 0 }}
    >
      <div className="flex h-full w-[192px] flex-col">
        <header className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-2">
          <span className="text-[10px] font-medium tracking-[0.18em] text-faint uppercase">设置</span>
          <span className="truncate text-xs text-text">{tool?.name ?? ""}</span>
          {tool?.settingsSchema && tool.settingsSchema.length > 0 && (
            <button className="icon-btn ml-auto" title="恢复默认" onClick={reset}>
              <RotateCcw size={13} />
            </button>
          )}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {!tool ? (
            <p className="text-xs leading-5 text-faint">激活一个工具后，可在此配置它的选项。</p>
          ) : !tool.settingsSchema || tool.settingsSchema.length === 0 ? (
            <p className="text-xs leading-5 text-faint">该工具没有可配置项。</p>
          ) : (
            tool.settingsSchema.map((field) =>
              field.type === "divider" ? (
                <DividerField key={field.key} field={field} />
              ) : visible(field, settings) ? (
                <FieldControl
                  key={field.key}
                  field={field}
                  settings={settings}
                  onChange={(v) => update({ [field.key]: v })}
                />
              ) : null,
            )
          )}
        </div>
      </div>
    </aside>
  );
}

function visible(field: SettingField, settings: ToolSettings): boolean {
  return field.type === "divider" || !field.visibleWhen || settings[field.visibleWhen.key] === field.visibleWhen.equals;
}

function FieldControl({
  field,
  settings,
  onChange,
}: {
  field: Extract<SettingField, { type: "toggle" | "select" | "number" | "text" }>;
  settings: ToolSettings;
  onChange: (value: string | number | boolean) => void;
}) {
  if (field.type === "toggle") {
    const checked = Boolean(settings[field.key]);
    // 注意：不能用 <label> 包 button——label 的默认激活行为会二次派发 click，开关切两次等于没切
    return (
      <div
        className="mb-2 flex cursor-pointer items-start justify-between gap-3"
        onClick={() => onChange(!checked)}
      >
        <span>
          <span className="block text-xs text-text">{field.label}</span>
          {field.hint && <span className="mt-0.5 block text-[10px] leading-4 text-faint">{field.hint}</span>}
        </span>
        <button
          role="switch"
          aria-checked={checked}
          aria-label={field.label}
          className={`mt-0.5 h-[16px] w-7 shrink-0 rounded-full border transition-colors ${checked ? "border-accent-dim bg-accent/25" : "border-line-strong bg-raise"}`}
        >
          <span
            className={`pointer-events-none block h-[10px] w-[10px] rounded-full transition-all ${checked ? "ml-[14px] bg-accent shadow-[0_0_6px_rgba(79,216,232,0.6)]" : "ml-[3px] bg-faint"}`}
          />
        </button>
      </div>
    );
  }

  if (field.type === "select") {
    return (
      <div className="mb-2">
        <label className="field-label">{field.label}</label>
        <select
          value={String(settings[field.key] ?? field.default)}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-md border border-line bg-raise px-2 py-1 text-xs text-text transition-colors hover:border-line-strong"
        >
          {field.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "number") {
    return (
      <div className="mb-2">
        <label className="field-label">{field.label}</label>
        <input
          type="number"
          value={Number(settings[field.key] ?? field.default)}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full rounded-md border border-line bg-raise px-2 py-1 text-xs text-text transition-colors hover:border-line-strong"
        />
      </div>
    );
  }

  return (
    <div className="mb-2">
      <label className="field-label">{field.label}</label>
      <input
        type="text"
        value={String(settings[field.key] ?? field.default)}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-line bg-raise px-2 py-1 text-xs text-text transition-colors hover:border-line-strong"
      />
    </div>
  );
}

function DividerField({ field }: { field: Extract<SettingField, { type: "divider" }> }) {
  if (!field.label) return <hr className="my-2 border-line" />;
  return (
    <div className="my-2 flex items-center gap-2">
      <span className="text-[10px] tracking-[0.14em] text-faint uppercase">{field.label}</span>
      <hr className="flex-1 border-line" />
    </div>
  );
}
