import { beforeEach, describe, expect, it } from "vitest";
import { MAX_MOUNTED_TABS, mountedTabIds, useTabs, type Tab } from "../src/platform/stores/tabs";

function mkTab(id: string, lastActiveAt = 0, auxInput = ""): Tab {
  return { id, toolId: "json-formatter", input: "", auxInput, createdAt: 0, lastActiveAt };
}

describe("tabs store：Tab 级附属输入（B2 回归）", () => {
  beforeEach(() => {
    useTabs.setState({ tabs: [], activeId: null });
  });

  it("setAuxInput 更新对应 Tab，不影响其他 Tab", () => {
    useTabs.setState({ tabs: [mkTab("a"), mkTab("b")], activeId: "a" });
    useTabs.getState().setAuxInput("b", '{"x":1}');
    const tabs = useTabs.getState().tabs;
    expect(tabs.find((t) => t.id === "b")!.auxInput).toBe('{"x":1}');
    expect(tabs.find((t) => t.id === "a")!.auxInput).toBe("");
  });

  it("auxInput 独立于 input 保留（卸载组件后仍在 store）", () => {
    useTabs.setState({ tabs: [mkTab("a")], activeId: "a" });
    useTabs.getState().setAuxInput("a", "RIGHT");
    useTabs.getState().setInput("a", "LEFT");
    // 模拟组件被 LRU 卸载：仅从挂载集合移除，store 数据不动
    expect(mountedTabIds(useTabs.getState().tabs, "a").has("a")).toBe(true);
    const t = useTabs.getState().tabs[0];
    expect(t.input).toBe("LEFT");
    expect(t.auxInput).toBe("RIGHT");
  });
});

describe("mountedTabIds：LRU 挂载预算（P2 回归）", () => {
  it("不超预算时全部挂载", () => {
    const tabs = Array.from({ length: 5 }, (_, i) => mkTab(`t${i}`, i));
    expect(mountedTabIds(tabs, "t4").size).toBe(5);
  });

  it("超预算只挂载最近 MAX_MOUNTED_TABS 个 + 激活 Tab", () => {
    const n = MAX_MOUNTED_TABS + 5;
    const tabs = Array.from({ length: n }, (_, i) => mkTab(`t${i}`, i)); // lastActiveAt 递增
    const ids = mountedTabIds(tabs, "t2"); // 激活一个较旧的 Tab
    expect(ids.size).toBe(MAX_MOUNTED_TABS + 1);
    expect(ids.has("t2")).toBe(true); // 激活恒挂载
    expect(ids.has(`t${n - 1}`)).toBe(true); // 最近使用
    expect(ids.has("t0")).toBe(false); // 最久未用被卸载
  });

  it("临界值：恰好 MAX_MOUNTED_TABS 个全部挂载", () => {
    const tabs = Array.from({ length: MAX_MOUNTED_TABS }, (_, i) => mkTab(`t${i}`, i));
    expect(mountedTabIds(tabs, "t0").size).toBe(MAX_MOUNTED_TABS);
  });
});
