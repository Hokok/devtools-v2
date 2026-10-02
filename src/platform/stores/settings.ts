import { create } from "zustand";
import { storage } from "../storage";
import type { ToolSettings } from "../types";

/**
 * 工具级全局配置（见 CONTEXT.md）：同工具所有 Tab 共享一份、跨重启保留。
 * 键 `settings.{toolId}`，写入防抖 500ms。存的是「对默认值的覆盖」；
 * 重置 = 清掉覆盖，默认值由工具实现体提供（随懒加载可用）。
 */

const DEBOUNCE_MS = 500;

interface SettingsState {
  byTool: Record<string, ToolSettings>;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (toolId: string, patch: ToolSettings) => void;
  reset: (toolId: string) => void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

function schedulePersist(get: () => SettingsState) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void storage.set("settings.byTool", get().byTool);
  }, DEBOUNCE_MS);
}

export const useSettings = create<SettingsState>((set, get) => ({
  byTool: {},
  hydrated: false,

  async hydrate() {
    if (get().hydrated) return;
    const saved = (await storage.get<Record<string, ToolSettings>>("settings.byTool").catch(() => ({}))) ?? {};
    // 竞态防护：hydrate 前用户已做的修改（内存中的 byTool）优先于磁盘旧值，
    // 否则启动瞬间改设置会被覆盖、且防抖定时器最终把覆盖值写回磁盘。
    set({ byTool: { ...saved, ...get().byTool }, hydrated: true });
  },

  update(toolId, patch) {
    const merged = { ...get().byTool[toolId], ...patch };
    set({ byTool: { ...get().byTool, [toolId]: merged } });
    schedulePersist(get);
  },

  reset(toolId) {
    const next = { ...get().byTool };
    delete next[toolId];
    set({ byTool: next });
    schedulePersist(get);
  },
}));
