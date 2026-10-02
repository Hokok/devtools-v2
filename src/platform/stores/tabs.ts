import { create } from "zustand";
import { registry } from "../registry";

/**
 * Tab = 工具实例（见 CONTEXT.md）。多开、会话内保活；
 * 输入内容只存在于内存 store——切换/卸载组件都不丢，重启即清空（用户决策）。
 */

export interface Tab {
  id: string;
  toolId: string;
  input: string;
  createdAt: number;
  lastActiveAt: number;
}

export const MAX_MOUNTED_TABS = 20;

interface TabsState {
  tabs: Tab[];
  activeId: string | null;
  openTool: (toolId: string) => void;
  closeTab: (id: string) => void;
  activate: (id: string) => void;
  /** 循环切换 Tab（Ctrl+Tab / Ctrl+Shift+Tab），dir 为 1（下一个）或 -1（上一个） */
  cycleTab: (dir: 1 | -1) => void;
  setInput: (id: string, input: string) => void;
}

function newTab(toolId: string): Tab {
  const now = Date.now();
  return { id: crypto.randomUUID(), toolId, input: "", createdAt: now, lastActiveAt: now };
}

/** 同工具的空 Tab 直接聚焦复用，避免手滑产生一堆空标签（DESIGN §3） */
function findReusableTab(tabs: Tab[], toolId: string): Tab | undefined {
  return tabs.find((t) => t.toolId === toolId && t.input === "");
}

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [],
  activeId: null,

  openTool(toolId) {
    if (!registry.some((t) => t.meta.id === toolId)) return;
    const { tabs } = get();
    const reusable = findReusableTab(tabs, toolId);
    if (reusable) {
      set({
        activeId: reusable.id,
        tabs: tabs.map((t) => (t.id === reusable.id ? { ...t, lastActiveAt: Date.now() } : t)),
      });
      return;
    }
    const tab = newTab(toolId);
    set({ tabs: [...tabs, tab], activeId: tab.id });
  },

  closeTab(id) {
    const { tabs, activeId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    const next = tabs.filter((t) => t.id !== id);
    let nextActive = activeId;
    if (activeId === id) {
      // Chrome 语义：优先激活右侧邻位，没有则左侧
      nextActive = (next[idx] ?? next[idx - 1])?.id ?? null;
    }
    set({ tabs: next, activeId: nextActive });
  },

  activate(id) {
    set({
      activeId: id,
      tabs: get().tabs.map((t) => (t.id === id ? { ...t, lastActiveAt: Date.now() } : t)),
    });
  },

  cycleTab(dir) {
    const { tabs, activeId } = get();
    if (tabs.length < 2) return;
    const i = Math.max(
      tabs.findIndex((t) => t.id === activeId),
      0,
    );
    const next = tabs[(i + dir + tabs.length) % tabs.length];
    set({
      activeId: next.id,
      tabs: tabs.map((t) => (t.id === next.id ? { ...t, lastActiveAt: Date.now() } : t)),
    });
  },

  setInput(id, input) {
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, input } : t)) });
  },
}));

/**
 * 保活策略：激活 Tab + 最近使用的 ≤MAX_MOUNTED_TABS 个 Tab 挂载组件，
 * 其余只保留 Tab 头与 store 中的输入，切回时无感重建（输入是受控的）。
 */
export function shouldMount(tab: Tab, activeId: string | null, all: Tab[]): boolean {
  if (tab.id === activeId) return true;
  const recent = [...all].sort((a, b) => b.lastActiveAt - a.lastActiveAt).slice(0, MAX_MOUNTED_TABS);
  return recent.some((t) => t.id === tab.id);
}
