import { create } from "zustand";

/**
 * 剪贴板历史（见 CONTEXT.md）：只记录**应用内**复制过的文本，纯内存、重启即清。
 * 刻意不监听系统剪贴板——隐私与轮询开销都不值得（见 PLAN 的形态锁定）。
 */

const MAX_ITEMS = 30;
/** 单条过大不入历史，避免几十 MB 的粘贴板把内存顶起来 */
const MAX_ENTRY_CHARS = 256 * 1024;

export interface ClipboardEntry {
  id: string;
  text: string;
  at: number;
}

interface ClipboardHistoryState {
  items: ClipboardEntry[];
  record: (text: string) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useClipboardHistory = create<ClipboardHistoryState>((set, get) => ({
  items: [],

  record(text) {
    if (!text || text.length > MAX_ENTRY_CHARS) return;
    const items = get().items;
    if (items[0]?.text === text) return; // 连续复制同一内容不重复入列
    const entry: ClipboardEntry = { id: crypto.randomUUID(), text, at: Date.now() };
    set({ items: [entry, ...items.filter((e) => e.text !== text)].slice(0, MAX_ITEMS) });
  },

  remove(id) {
    set({ items: get().items.filter((e) => e.id !== id) });
  },

  clear() {
    set({ items: [] });
  },
}));
