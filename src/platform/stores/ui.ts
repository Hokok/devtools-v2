import { create } from "zustand";
import { storage } from "../storage";

/** 用户选择的外观模式；theme 是解析后的实际外观（跟随系统时随系统变） */
export type ThemeMode = "dark" | "light" | "system";
export type Theme = "dark" | "light";
/** 布局模板输入/输出区的排列方向：上下分栏 | 左右分栏 */
export type LayoutDirection = "vertical" | "horizontal";

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return; // node 测试环境无 DOM
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

const resolveTheme = (mode: ThemeMode): Theme => (mode === "system" ? systemTheme() : mode);

/** 跟随系统时监听系统外观变化并实时重解析；切走时解除监听 */
let detachSystemWatch: (() => void) | null = null;
function watchSystemMode(mode: ThemeMode, onResolve: (theme: Theme) => void) {
  detachSystemWatch?.();
  detachSystemWatch = null;
  if (mode !== "system" || typeof matchMedia === "undefined") return;
  const mq = matchMedia("(prefers-color-scheme: light)");
  const onChange = () => onResolve(mq.matches ? "light" : "dark");
  mq.addEventListener("change", onChange);
  detachSystemWatch = () => mq.removeEventListener("change", onChange);
}

function mirrorMode(mode: ThemeMode) {
  // 镜像到 localStorage：index.html 的首帧脚本读得到，避免 Tauri 下亮色用户白闪
  try {
    localStorage.setItem("ui.themeMode", JSON.stringify(mode));
  } catch {
    /* 隐私模式等场景静默 */
  }
}

/** 工作台外观与布局状态：外观模式、布局方向、左栏收缩、面板开合、分栏比例，均跨重启保留。 */
interface UiState {
  /** 解析后的实际外观（渲染与 CodeMirror 主题都吃它） */
  theme: Theme;
  themeMode: ThemeMode;
  layoutDirection: LayoutDirection;
  navCollapsed: boolean;
  settingsOpen: boolean;
  globalSettingsOpen: boolean;
  paletteOpen: boolean;
  exitConfirmOpen: boolean;
  /** 布局模板输入/输出分栏比例，按工具记忆（0.15–0.85） */
  splitRatios: Record<string, number>;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setLayoutDirection: (direction: LayoutDirection) => void;
  toggleLayoutDirection: () => void;
  toggleNav: () => void;
  toggleSettings: () => void;
  setGlobalSettingsOpen: (open: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setSplitRatio: (toolId: string, ratio: number) => void;
  hydrate: () => Promise<void>;
}

let hydrated = false;

export const useUi = create<UiState>((set, get) => ({
  theme: "dark",
  themeMode: "system",
  layoutDirection: "vertical",
  navCollapsed: false,
  settingsOpen: false,
  globalSettingsOpen: false,
  paletteOpen: false,
  exitConfirmOpen: false,
  splitRatios: {},

  setThemeMode(mode) {
    const theme = resolveTheme(mode);
    set({ themeMode: mode, theme });
    applyTheme(theme);
    watchSystemMode(mode, (t) => {
      set({ theme: t });
      applyTheme(t);
    });
    void storage.set("ui.themeMode", mode);
    mirrorMode(mode);
  },

  // 侧栏日/月快捷切换：从当前实际外观切到另一面，并落为显式模式
  toggleTheme: () => get().setThemeMode(get().theme === "dark" ? "light" : "dark"),

  setLayoutDirection(direction) {
    set({ layoutDirection: direction });
    void storage.set("ui.layoutDirection", direction);
  },

  toggleLayoutDirection: () =>
    get().setLayoutDirection(get().layoutDirection === "vertical" ? "horizontal" : "vertical"),

  toggleNav: () => {
    set({ navCollapsed: !get().navCollapsed });
    void storage.set("ui.navCollapsed", get().navCollapsed);
  },

  toggleSettings: () => {
    set({ settingsOpen: !get().settingsOpen });
    void storage.set("ui.settingsOpen", get().settingsOpen);
  },

  setGlobalSettingsOpen: (open) => set({ globalSettingsOpen: open }),

  setPaletteOpen: (open) => set({ paletteOpen: open }),

  setSplitRatio(toolId, ratio) {
    const clamped = Math.min(0.85, Math.max(0.15, ratio));
    set({ splitRatios: { ...get().splitRatios, [toolId]: clamped } });
    void storage.set("ui.splitRatios", get().splitRatios);
  },

  async hydrate() {
    if (hydrated) return;
    hydrated = true;
    const [nav, panel, mode, legacyTheme, direction, ratios] = await Promise.all([
      storage.get<boolean>("ui.navCollapsed").catch(() => undefined),
      storage.get<boolean>("ui.settingsOpen").catch(() => undefined),
      storage.get<ThemeMode>("ui.themeMode").catch(() => undefined),
      storage.get<Theme>("ui.theme").catch(() => undefined),
      storage.get<LayoutDirection>("ui.layoutDirection").catch(() => undefined),
      storage.get<Record<string, number>>("ui.splitRatios").catch(() => undefined),
    ]);
    // 旧版只有 ui.theme（dark/light）——迁移为 themeMode；全新安装跟随系统
    const themeMode: ThemeMode = mode ?? legacyTheme ?? "system";
    const theme = resolveTheme(themeMode);
    set({
      navCollapsed: nav ?? false,
      // 首次使用默认展开设置面板（配置是若干工具的核心交互），用户关过后记住偏好
      settingsOpen: panel ?? true,
      themeMode,
      theme,
      layoutDirection: direction ?? "vertical",
      splitRatios: ratios ?? {},
    });
    applyTheme(theme);
    watchSystemMode(themeMode, (t) => {
      set({ theme: t });
      applyTheme(t);
    });
    void storage.set("ui.themeMode", themeMode); // 固化迁移结果，下次直接读新键
    mirrorMode(themeMode);
  },
}));
