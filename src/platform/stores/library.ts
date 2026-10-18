import { create } from "zustand";
import { storage } from "../storage";

/**
 * 工具库（见 CONTEXT.md：收藏工具 / 最近使用）。
 *
 * - 收藏（favorites）：应用偏好，跨重启保留（键 `library.favorites`）。
 * - 最近使用（recents）：会话态，重启即清。
 *
 * 只存工具 id；元信息一律回注册表查，避免与注册表产生第二份真相。
 */

const MAX_RECENTS = 8;

interface LibraryState {
  favorites: string[];
  recents: string[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  toggleFavorite: (toolId: string) => void;
  pushRecent: (toolId: string) => void;
}

let hydrated = false;

export const useLibrary = create<LibraryState>((set, get) => ({
  favorites: [],
  recents: [],
  hydrated: false,

  async hydrate() {
    if (hydrated) return;
    hydrated = true;
    const saved = (await storage.get<string[]>("library.favorites").catch(() => undefined)) ?? [];
    // 竞态防护：hydrate 前用户已点过的收藏优先（与 settings store 同口径）
    const merged = [...new Set([...get().favorites, ...saved])];
    set({ favorites: merged, hydrated: true });
  },

  toggleFavorite(toolId) {
    const favorites = get().favorites.includes(toolId)
      ? get().favorites.filter((id) => id !== toolId)
      : [...get().favorites, toolId];
    set({ favorites });
    void storage.set("library.favorites", favorites);
  },

  pushRecent(toolId) {
    const recents = [toolId, ...get().recents.filter((id) => id !== toolId)].slice(0, MAX_RECENTS);
    set({ recents });
  },
}));
