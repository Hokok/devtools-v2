import { create } from "zustand";

/**
 * 会话历史（见 CONTEXT.md）：每个工具保留最近若干条**输入**，纯内存、重启即清。
 *
 * 记录时机是刻意的——只在「输入会被覆盖或消失」的时刻留档，而不是逐键记录：
 * 清空、外部载入（粘贴 / 文件 / 示例 / 发送到）、关闭标签页。
 * 这样历史里是有意义的版本，而不是一串半截打字草稿。
 */

const MAX_PER_TOOL = 20;

export interface HistoryEntry {
  id: string;
  text: string;
  /** 置顶项不参与容量淘汰 */
  pinned: boolean;
  at: number;
}

interface HistoryState {
  byTool: Record<string, HistoryEntry[]>;
  /** 留档；trim 后为空则忽略；与最新一条重复则上移去重 */
  remember: (toolId: string, text: string) => void;
  remove: (toolId: string, id: string) => void;
  togglePin: (toolId: string, id: string) => void;
  clear: (toolId: string) => void;
}

function trim(entries: HistoryEntry[]): HistoryEntry[] {
  if (entries.length <= MAX_PER_TOOL) return entries;
  // 从尾部淘汰未置顶项，直到落回上限；置顶项一律保留
  const kept: HistoryEntry[] = [];
  for (const entry of entries) {
    if (entry.pinned || kept.length < MAX_PER_TOOL) kept.push(entry);
  }
  return kept;
}

export const useHistory = create<HistoryState>((set, get) => ({
  byTool: {},

  remember(toolId, text) {
    const value = text.trim() === "" ? "" : text;
    if (!value) return;
    const list = get().byTool[toolId] ?? [];
    if (list[0]?.text === value) {
      // 与最新一条相同：仅刷新时间与 id，避免堆重复
      const head: HistoryEntry = { ...list[0], id: crypto.randomUUID(), at: Date.now() };
      set({ byTool: { ...get().byTool, [toolId]: trim([head, ...list.slice(1)]) } });
      return;
    }
    const entry: HistoryEntry = { id: crypto.randomUUID(), text: value, pinned: false, at: Date.now() };
    set({
      byTool: {
        ...get().byTool,
        [toolId]: trim([entry, ...list.filter((e) => e.text !== value)]),
      },
    });
  },

  remove(toolId, id) {
    const list = get().byTool[toolId] ?? [];
    set({ byTool: { ...get().byTool, [toolId]: list.filter((e) => e.id !== id) } });
  },

  togglePin(toolId, id) {
    const list = get().byTool[toolId] ?? [];
    set({
      byTool: {
        ...get().byTool,
        [toolId]: trim(list.map((e) => (e.id === id ? { ...e, pinned: !e.pinned } : e))),
      },
    });
  },

  clear(toolId) {
    const next = { ...get().byTool };
    delete next[toolId];
    set({ byTool: next });
  },
}));
