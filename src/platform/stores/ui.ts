import { create } from "zustand";
import { storage } from "../storage";

export type Theme = "dark" | "light";

function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.dataset.theme = "light";
  } else {
    delete document.documentElement.dataset.theme;
  }
}

function systemTheme(): Theme {
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/** 工作台外观状态：主题、左栏收缩、设置面板开合、分栏比例，均跨重启保留。 */
interface UiState {
  theme: Theme;
  navCollapsed: boolean;
  settingsOpen: boolean;
  paletteOpen: boolean;
  exitConfirmOpen: boolean;
  /** 布局模板输入/输出分栏比例，按工具记忆（0.15–0.85） */
  splitRatios: Record<string, number>;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  toggleNav: () => void;
  toggleSettings: () => void;
  setPaletteOpen: (open: boolean) => void;
  setSplitRatio: (toolId: string, ratio: number) => void;
  hydrate: () => Promise<void>;
}

let hydrated = false;

export const useUi = create<UiState>((set, get) => ({
  theme: "dark",
  navCollapsed: false,
  settingsOpen: false,
  paletteOpen: false,
  exitConfirmOpen: false,
  splitRatios: {},

  setTheme(theme) {
    set({ theme });
    applyTheme(theme);
    void storage.set("ui.theme", theme);
    // 镜像到 localStorage：index.html 的首帧脚本读得到，避免 Tauri 下亮色用户白闪
    try {
      localStorage.setItem("ui.theme", JSON.stringify(theme));
    } catch {
      /* 隐私模式等场景静默 */
    }
  },

  toggleTheme: () => get().setTheme(get().theme === "dark" ? "light" : "dark"),

  toggleNav: () => {
    set({ navCollapsed: !get().navCollapsed });
    void storage.set("ui.navCollapsed", get().navCollapsed);
  },

  toggleSettings: () => {
    set({ settingsOpen: !get().settingsOpen });
    void storage.set("ui.settingsOpen", get().settingsOpen);
  },

  setPaletteOpen: (open) => set({ paletteOpen: open }),

  setSplitRatio(toolId, ratio) {
    const clamped = Math.min(0.85, Math.max(0.15, ratio));
    set({ splitRatios: { ...get().splitRatios, [toolId]: clamped } });
    void storage.set("ui.splitRatios", get().splitRatios);
  },

  async hydrate() {
    if (hydrated) return;
    hydrated = true;
    const [nav, panel, theme, ratios] = await Promise.all([
      storage.get<boolean>("ui.navCollapsed").catch(() => undefined),
      storage.get<boolean>("ui.settingsOpen").catch(() => undefined),
      storage.get<Theme>("ui.theme").catch(() => undefined),
      storage.get<Record<string, number>>("ui.splitRatios").catch(() => undefined),
    ]);
    const resolvedTheme = theme === "light" || theme === "dark" ? theme : systemTheme();
    set({
      navCollapsed: nav ?? false,
      // 首次使用默认展开设置面板（配置是若干工具的核心交互），用户关过后记住偏好
      settingsOpen: panel ?? true,
      theme: resolvedTheme,
      splitRatios: ratios ?? {},
    });
    applyTheme(resolvedTheme);
    // 同步镜像，保证首帧脚本下次读到的与实际一致
    try {
      localStorage.setItem("ui.theme", JSON.stringify(resolvedTheme));
    } catch {
      /* 同上 */
    }
  },
}));
