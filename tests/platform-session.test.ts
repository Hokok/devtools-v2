import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Braces } from "lucide-react";
import { defineTool, registerAll } from "../src/platform/registry";
import { useClipboardHistory } from "../src/platform/stores/clipboardHistory";
import { useHistory } from "../src/platform/stores/history";
import { useTabs } from "../src/platform/stores/tabs";

const fakeImpl = async () => ({ defaultSettings: {} });

registerAll([
  defineTool({ id: "json-formatter", name: "JSON 格式化", description: "", icon: Braces, group: "format" }, fakeImpl),
  defineTool({ id: "fake-a", name: "假工具 A", description: "", icon: Braces, group: "format" }, fakeImpl),
  defineTool({ id: "fake-b", name: "假工具 B", description: "", icon: Braces, group: "format" }, fakeImpl),
]);

beforeEach(() => {
  useTabs.setState({ tabs: [], activeId: null });
  useHistory.setState({ byTool: {} });
  useClipboardHistory.setState({ items: [] });
});

afterEach(() => vi.unstubAllGlobals());

describe("会话历史（每工具、只存输入、上限 20）", () => {
  it("留档、忽略空白、连续重复不堆积", () => {
    const h = useHistory.getState();
    h.remember("fake-a", "one");
    h.remember("fake-a", "   ");
    h.remember("fake-a", "one");
    const list = useHistory.getState().byTool["fake-a"];
    expect(list).toHaveLength(1);
    expect(list[0].text).toBe("one");
  });

  it("重复旧内容会提到最前且不重复", () => {
    const h = useHistory.getState();
    ["a", "b", "c"].forEach((t) => h.remember("fake-a", t));
    h.remember("fake-a", "a");
    expect(useHistory.getState().byTool["fake-a"].map((e) => e.text)).toEqual(["a", "c", "b"]);
  });

  it("超上限淘汰最旧未置顶项", () => {
    const h = useHistory.getState();
    for (let i = 0; i < 25; i++) h.remember("fake-a", `line-${i}`);
    const list = useHistory.getState().byTool["fake-a"];
    expect(list).toHaveLength(20);
    expect(list[0].text).toBe("line-24");
    expect(list.some((e) => e.text === "line-0")).toBe(false);
  });

  it("置顶项不被容量淘汰", () => {
    const h = useHistory.getState();
    h.remember("fake-a", "keep-me");
    const pinnedId = useHistory.getState().byTool["fake-a"][0].id;
    h.togglePin("fake-a", pinnedId);
    for (let i = 0; i < 25; i++) h.remember("fake-a", `new-${i}`);
    const list = useHistory.getState().byTool["fake-a"];
    expect(list.some((e) => e.text === "keep-me" && e.pinned)).toBe(true);
  });

  it("remove / clear", () => {
    const h = useHistory.getState();
    h.remember("fake-a", "x");
    h.remember("fake-a", "y");
    const id = useHistory.getState().byTool["fake-a"][0].id;
    h.remove("fake-a", id);
    expect(useHistory.getState().byTool["fake-a"]).toHaveLength(1);
    h.clear("fake-a");
    expect(useHistory.getState().byTool["fake-a"]).toBeUndefined();
  });
});

describe("剪贴板历史（应用内、上限 30、超大不入列）", () => {
  it("连续同内容不重复，旧内容复用会提前", () => {
    const c = useClipboardHistory.getState();
    c.record("a");
    c.record("a");
    c.record("b");
    c.record("a");
    expect(useClipboardHistory.getState().items.map((i) => i.text)).toEqual(["a", "b"]);
  });

  it("超过单条上限的文本直接跳过", () => {
    useClipboardHistory.getState().record("x".repeat(256 * 1024 + 1));
    expect(useClipboardHistory.getState().items).toHaveLength(0);
  });

  it("超过 30 条淘汰最旧", () => {
    const c = useClipboardHistory.getState();
    for (let i = 0; i < 35; i++) c.record(`item-${i}`);
    expect(useClipboardHistory.getState().items).toHaveLength(30);
    expect(useClipboardHistory.getState().items[0].text).toBe("item-34");
  });
});

describe("Tab：带初始输入开标签页 / 载入到激活标签页", () => {
  it("openTool 带初始输入即填入新标签页", () => {
    useTabs.getState().openTool("fake-a", "hello");
    const tabs = useTabs.getState().tabs;
    expect(tabs).toHaveLength(1);
    expect(tabs[0].input).toBe("hello");
  });

  it("复用同工具的空标签页并填入内容", () => {
    useTabs.getState().openTool("fake-a");
    useTabs.getState().openTool("fake-b");
    useTabs.getState().openTool("fake-a", "sent");
    const tabs = useTabs.getState().tabs;
    expect(tabs.filter((t) => t.toolId === "fake-a")).toHaveLength(1);
    expect(tabs.find((t) => t.toolId === "fake-a")!.input).toBe("sent");
  });

  it("loadTextIntoActive 无激活标签页时落到默认工具（JSON 格式化）", () => {
    useTabs.getState().loadTextIntoActive("dropped");
    const tabs = useTabs.getState().tabs;
    expect(tabs).toHaveLength(1);
    expect(tabs[0].toolId).toBe("json-formatter");
    expect(tabs[0].input).toBe("dropped");
  });

  it("loadTextIntoActive 覆盖激活标签页输入，并把旧内容留档进会话历史", () => {
    useTabs.getState().openTool("fake-a", "old");
    useTabs.getState().loadTextIntoActive("new");
    expect(useTabs.getState().tabs[0].input).toBe("new");
    expect(useHistory.getState().byTool["fake-a"].map((e) => e.text)).toContain("old");
  });

  it("清空输入即留档（setInput 空值路径）", () => {
    useTabs.getState().openTool("fake-a", "typed");
    const id = useTabs.getState().tabs[0].id;
    useTabs.getState().setInput(id, "");
    expect(useHistory.getState().byTool["fake-a"].map((e) => e.text)).toContain("typed");
  });

  it("关闭标签页把内容留档", () => {
    useTabs.getState().openTool("fake-a", "bye");
    const id = useTabs.getState().tabs[0].id;
    useTabs.getState().closeTab(id);
    expect(useHistory.getState().byTool["fake-a"].map((e) => e.text)).toContain("bye");
  });
});
