/**
 * 持久化适配器：Tauri 环境用官方 store 插件（JSON 落盘应用配置目录），
 * 纯浏览器 dev 环境降级 localStorage，保证 `pnpm dev` 不依赖 Rust 侧即可调试。
 */

export interface StorageAdapter {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

let tauriStore: Promise<import("@tauri-apps/plugin-store").Store> | null = null;

function getTauriStore() {
  tauriStore ??= import("@tauri-apps/plugin-store").then(({ load }) =>
    load("workbench.json", { autoSave: true }),
  );
  return tauriStore;
}

const ls: StorageAdapter = {
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  },
  async set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
};

const tauri: StorageAdapter = {
  async get<T = unknown>(key: string): Promise<T | undefined> {
    const store = await getTauriStore();
    return (await store.get<T>(key)) as T | undefined;
  },
  async set(key, value) {
    const store = await getTauriStore();
    await store.set(key, value);
  },
};

export const storage: StorageAdapter = isTauri ? tauri : ls;
