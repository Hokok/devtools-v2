import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type UiModule = typeof import("../src/platform/stores/ui");

/**
 * node 测试环境没有 DOM/matchMedia/localStorage——打桩出浏览器最小面。
 * ui store 的 applyTheme/mirrorMode/system 侦听都落在这些全局上。
 */
function stubEnv(initialSystemLight = false) {
  let systemLight = initialSystemLight;
  const changeListeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    // 真实 MediaQueryList.matches 是活值（getter），必须随 systemLight 翻转
    get matches() {
      return query.includes("light") ? systemLight : !systemLight;
    },
    addEventListener: (_type: string, fn: () => void) => changeListeners.add(fn),
    removeEventListener: (_type: string, fn: () => void) => changeListeners.delete(fn),
  }));
  const documentElement = { dataset: {} as Record<string, string> };
  vi.stubGlobal("document", { documentElement });
  const kv = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => kv.get(key) ?? null,
    setItem: (key: string, value: string) => void kv.set(key, value),
    removeItem: (key: string) => void kv.delete(key),
  });
  return {
    kv,
    documentElement,
    /** 系统外观翻转：仅 system 模式下订阅者会被通知 */
    flipSystem(light: boolean) {
      systemLight = light;
      changeListeners.forEach((fn) => fn());
    },
  };
}

/** 每个用例重新加载模块，重置 zustand store 与 hydrated 标记 */
async function loadUi(): Promise<UiModule> {
  vi.resetModules();
  return import("../src/platform/stores/ui");
}

describe("useUi（外观模式与布局方向）", () => {
  let env: ReturnType<typeof stubEnv>;

  beforeEach(() => {
    env = stubEnv();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("全新安装默认跟随系统，且实时响应系统外观变化", async () => {
    const { useUi } = await loadUi();
    await useUi.getState().hydrate();

    expect(useUi.getState().themeMode).toBe("system");
    expect(useUi.getState().theme).toBe("dark");
    expect(env.kv.get("ui.themeMode")).toBe(JSON.stringify("system"));

    env.flipSystem(true);
    expect(useUi.getState().theme).toBe("light");
    expect(env.documentElement.dataset.theme).toBe("light");

    env.flipSystem(false);
    expect(useUi.getState().theme).toBe("dark");
    expect("theme" in env.documentElement.dataset).toBe(false);
  });

  it("旧键 ui.theme（dark/light）迁移为显式 themeMode，不再受系统变化影响", async () => {
    env.kv.set("ui.theme", JSON.stringify("dark"));
    const { useUi } = await loadUi();
    await useUi.getState().hydrate();

    expect(useUi.getState().themeMode).toBe("dark");
    expect(useUi.getState().theme).toBe("dark");
    // 固化迁移结果：新键落盘，旧语义不再解析
    expect(env.kv.get("ui.themeMode")).toBe(JSON.stringify("dark"));

    env.flipSystem(true);
    expect(useUi.getState().theme).toBe("dark");
  });

  it("setThemeMode 切换外观并落镜像；system 模式下恢复跟随", async () => {
    const { useUi } = await loadUi();
    await useUi.getState().hydrate();

    useUi.getState().setThemeMode("light");
    expect(useUi.getState().themeMode).toBe("light");
    expect(env.documentElement.dataset.theme).toBe("light");
    expect(env.kv.get("ui.themeMode")).toBe(JSON.stringify("light"));
    // 显式模式下系统翻转不应影响
    env.flipSystem(false);
    expect(useUi.getState().theme).toBe("light");

    useUi.getState().setThemeMode("system");
    expect(useUi.getState().theme).toBe("dark");
  });

  it("侧栏日/月快捷切换把跟随系统落为显式的另一面", async () => {
    const { useUi } = await loadUi();
    await useUi.getState().hydrate(); // system → dark

    useUi.getState().toggleTheme();
    expect(useUi.getState().themeMode).toBe("light");
    expect(useUi.getState().theme).toBe("light");

    useUi.getState().toggleTheme();
    expect(useUi.getState().themeMode).toBe("dark");
  });

  it("布局方向默认上下分栏，切换后持久化", async () => {
    const { useUi } = await loadUi();
    await useUi.getState().hydrate();

    expect(useUi.getState().layoutDirection).toBe("vertical");

    useUi.getState().toggleLayoutDirection();
    expect(useUi.getState().layoutDirection).toBe("horizontal");
    expect(env.kv.get("ui.layoutDirection")).toBe(JSON.stringify("horizontal"));

    useUi.getState().setLayoutDirection("vertical");
    expect(useUi.getState().layoutDirection).toBe("vertical");
  });

  it("已存布局方向与主题模式在 hydrate 时恢复", async () => {
    env.kv.set("ui.themeMode", JSON.stringify("light"));
    env.kv.set("ui.layoutDirection", JSON.stringify("horizontal"));
    const { useUi } = await loadUi();
    await useUi.getState().hydrate();

    expect(useUi.getState().themeMode).toBe("light");
    expect(useUi.getState().theme).toBe("light");
    expect(useUi.getState().layoutDirection).toBe("horizontal");
  });
});
