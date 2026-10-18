import { create } from "zustand";
import { registry } from "../registry";
import { useHistory } from "./history";
import { useLibrary } from "./library";

/**
 * Tab = 工具实例（见 CONTEXT.md）。多开、会话内保活；
 * 输入内容（input 与异形工具的 auxInput）只存在于内存 store——
 * 切换/卸载组件都不丢，重启即清空（用户决策）。
 */

export interface Tab {
  id: string;
  toolId: string;
  input: string;
  /** Tab 级附属输入（异形工具的第二输入，如 JSON 比对右侧）；与 input 同等保活 */
  auxInput: string;
  createdAt: number;
  lastActiveAt: number;
}

export const MAX_MOUNTED_TABS = 20;

/** 无标签页时文件载入的落点：不按扩展名路由，统一落到最通用的 JSON 格式化 */
export const DEFAULT_TOOL_ID = "json-formatter";

interface TabsState {
  tabs: Tab[];
  activeId: string | null;
  /** initialInput：带初始内容开标签页（发送到 / 文件载入）；省略则开空标签页 */
  openTool: (toolId: string, initialInput?: string) => void;
  closeTab: (id: string) => void;
  activate: (id: string) => void;
  /** 循环切换 Tab（Ctrl+Tab / Ctrl+Shift+Tab），dir 为 1（下一个）或 -1（上一个） */
  cycleTab: (dir: 1 | -1) => void;
  setInput: (id: string, input: string) => void;
  setAuxInput: (id: string, input: string) => void;
  /** 把文本载入当前激活标签页；无激活标签页则开默认工具的新标签页 */
  loadTextIntoActive: (text: string) => void;
  /** 把当前输入快照进会话历史（用于文件载入 / 发送到等覆盖场景） */
  rememberInput: (id: string) => void;
}

function newTab(toolId: string): Tab {
  const now = Date.now();
  return { id: crypto.randomUUID(), toolId, input: "", auxInput: "", createdAt: now, lastActiveAt: now };
}

/** 同工具的空 Tab 直接聚焦复用，避免手滑产生一堆空标签（DESIGN §3） */
function findReusableTab(tabs: Tab[], toolId: string): Tab | undefined {
  return tabs.find((t) => t.toolId === toolId && t.input === "");
}

export const useTabs = create<TabsState>((set, get) => ({
  tabs: [],
  activeId: null,

  openTool(toolId, initialInput) {
    if (!registry.some((t) => t.meta.id === toolId)) return;
    useLibrary.getState().pushRecent(toolId);
    const { tabs } = get();
    const reusable = findReusableTab(tabs, toolId);
    if (reusable) {
      set({
        activeId: reusable.id,
        tabs: tabs.map((t) =>
          t.id === reusable.id
            ? { ...t, input: initialInput ?? t.input, lastActiveAt: Date.now() }
            : t,
        ),
      });
      return;
    }
    const tab = newTab(toolId);
    if (initialInput !== undefined) tab.input = initialInput;
    set({ tabs: [...tabs, tab], activeId: tab.id });
  },

  closeTab(id) {
    const { tabs, activeId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    if (idx === -1) return;
    // 关掉的 Tab 内容即将消失——留档进会话历史，给用户一次找回的机会
    useHistory.getState().remember(tabs[idx].toolId, tabs[idx].input);
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
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === id);
    // 清空即留档：被清掉的内容进会话历史（逐键输入不触发，只在非空→空时）
    if (tab && input === "" && tab.input !== "") {
      useHistory.getState().remember(tab.toolId, tab.input);
    }
    set({ tabs: tabs.map((t) => (t.id === id ? { ...t, input } : t)) });
  },

  setAuxInput(id, input) {
    set({ tabs: get().tabs.map((t) => (t.id === id ? { ...t, auxInput: input } : t)) });
  },

  loadTextIntoActive(text) {
    const { tabs, activeId } = get();
    const active = tabs.find((t) => t.id === activeId);
    if (!active) {
      get().openTool(DEFAULT_TOOL_ID, text);
      return;
    }
    // 被覆盖的旧内容先进历史
    useHistory.getState().remember(active.toolId, active.input);
    set({ tabs: tabs.map((t) => (t.id === active.id ? { ...t, input: text } : t)) });
  },

  rememberInput(id) {
    const tab = get().tabs.find((t) => t.id === id);
    if (tab) useHistory.getState().remember(tab.toolId, tab.input);
  },
}));

/**
 * 保活策略：激活 Tab + 最近使用的 ≤MAX_MOUNTED_TABS 个 Tab 挂载组件，
 * 其余只保留 Tab 头与 store 中的输入，切回时无感重建（输入是受控的）。
 *
 * 返回一次性算好的「应挂载集合」——由调用方（ToolHost）在每次渲染只算一次，
 * 避免对每个 Tab 都排序整个数组（原实现的 O(N²·logN)）。
 */
export function mountedTabIds(all: Tab[], activeId: string | null): Set<string> {
  if (all.length <= MAX_MOUNTED_TABS) return new Set(all.map((t) => t.id));
  const recent = [...all].sort((a, b) => b.lastActiveAt - a.lastActiveAt).slice(0, MAX_MOUNTED_TABS);
  const ids = new Set(recent.map((t) => t.id));
  if (activeId) ids.add(activeId);
  return ids;
}
