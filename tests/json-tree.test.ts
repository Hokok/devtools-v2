import { describe, expect, it } from "vitest";
import { diffJson } from "../src/tools/json-diff/diff";
import type { JsonTreeNode } from "../src/tools/json-common/tree";
import {
  TREE_MAX_CHARS,
  TREE_MAX_NODES,
  buildJsonTree,
  collectExpandable,
  collectMatches,
  flattenRows,
  pickMark,
} from "../src/tools/json-common/tree";

/** 按路径找节点（定位路径语法：点路径 + [n]） */
function findByPath(node: JsonTreeNode, path: string): JsonTreeNode {
  for (const matchAll of path.matchAll(/(?<=^|\.)([^.\[\]]+)|\[(\d+)\]/g)) {
    const [, key, index] = matchAll;
    next: {
      if (index !== undefined) {
        const found = node.children.find((c) => c.isIndex && c.key === index);
        if (!found) throw new Error(`无下标 ${index} 于 ${path}`);
        node = found;
        break next;
      }
      const found = node.children.find((c) => c.key === key);
      if (!found) throw new Error(`无 key ${key} 于 ${path}`);
      node = found;
    }
  }
  return node;
}

describe("buildJsonTree：结构与路径", () => {
  const text = '{"a":{"b":[1,"two"]},"c":true,"d":null,"e":3.14}';
  const build = buildJsonTree(text);

  it("产出树与节点计数", () => {
    expect(build.kind).toBe("tree");
    if (build.kind !== "tree") return;
    // 根 + a + b + 1 + "two" + c + d + e = 8
    expect(build.nodes).toBe(8);
  });

  if (build.kind === "tree") {
    it("路径符合定位路径语法（点路径 + [n]）", () => {
      expect(findByPath(build.root, "a.b[1]").path).toBe("a.b[1]");
      expect(findByPath(build.root, "e").type).toBe("number");
      expect(findByPath(build.root, "c").text).toBe("true");
    });

    it("根容器不占一行；根路径为空", () => {
      expect(build.root.path).toBe("");
      const rows = flattenRows(build.root, new Set());
      expect(rows[0].node.key).toBe("a");
      expect(rows[0].depth).toBe(0);
    });
  }

  it("标量根显示一行", () => {
    const scalar = buildJsonTree("42");
    expect(scalar.kind).toBe("tree");
    if (scalar.kind !== "tree") return;
    expect(flattenRows(scalar.root, new Set())).toHaveLength(1);
    expect(scalar.root.text).toBe("42");
  });

  it("空容器不可折叠；字符串带引号转义", () => {
    const build2 = buildJsonTree('{"e":{},"f":[]}');
    if (build2.kind !== "tree") throw new Error("should be tree");
    expect(build2.root.children.every((c) => !c.expandable)).toBe(true);
    const escaped = buildJsonTree('{"s":"a\\"b\\n"}');
    if (escaped.kind !== "tree") throw new Error("should be tree");
    expect(escaped.root.children[0].text).toBe('"a\\"b\\n"');
  });
});

describe("buildJsonTree：阈值与非法", () => {
  it(`超 ${TREE_MAX_CHARS} 字符 → too-large（不解析）`, () => {
    expect(buildJsonTree(`"${"x".repeat(TREE_MAX_CHARS)}"`).kind).toBe("too-large");
  });

  it(`超 ${TREE_MAX_NODES} 节点 → too-large`, () => {
    const huge = JSON.stringify(Array.from({ length: TREE_MAX_NODES }, (_, i) => i));
    expect(buildJsonTree(huge).kind).toBe("too-large");
  });

  it("\u9608\u5185\u7684\u5927\u6570\u7ec4\u53ef\u4ee5\u5efa\u6811", () => {
    const ok = JSON.stringify(Array.from({ length: TREE_MAX_NODES - 2 }, (_, i) => i));
    expect(buildJsonTree(ok).kind).toBe("tree");
  });

  it("\u975e\u6cd5 JSON \u2192 invalid", () => {
    expect(buildJsonTree('{"a": ,}').kind).toBe("invalid");
  });
});

describe("flattenRows：折叠与搜索", () => {
  const text = '{"a":{"x":1,"y":2},"b":{"z":[1]}}';
  const build = buildJsonTree(text);
  if (build.kind !== "tree") throw new Error("should be tree");
  const root = build.root;
  const a = root.children[0];
  const b = root.children[1];
  const aY = a.children[1];

  it("默认全展开 = 折叠集合为空", () => {
    expect(flattenRows(root, new Set())).toHaveLength(6); // a x y b z(数组) z 的 1
  });

  it("折叠 a 隐藏其子树", () => {
    const rows = flattenRows(root, new Set([a]));
    expect(rows.map((r) => r.node.key)).toEqual(["a", "b", "z", "0"]);
    expect(collectMatches(root, "y").size).toBeGreaterThan(0);
  });

  it("搜索命中：祖先连带可见、命中分支强制展开", () => {
    const hits = collectMatches(root, "y");
    expect(hits.has(aY)).toBe(true);
    expect(hits.has(a)).toBe(true); // 祖先连带
    expect(hits.has(b)).toBe(false);
    const rows = flattenRows(root, new Set(collectExpandable(root)), hits);
    expect(rows.some((r) => r.node === aY)).toBe(true);
  });

  it("搜索也命中字符串值", () => {
    const build3 = buildJsonTree('{"msg":"hello"}');
    if (build3.kind !== "tree") throw new Error("tree");
    expect(collectMatches(build3.root, "hell").has(build3.root.children[0])).toBe(true);
  });
});

describe("pickMark：差异标色与 diff range 对齐", () => {
  const left = '{"a":{"x":1},"b":2,"c":3}';
  const right = '{"b":2,"c":9}';
  const build = buildJsonTree(left);
  if (build.kind !== "tree") throw new Error("tree");
  const { root } = build;
  const { entries } = diffJson(left, right);

  it("仅左侧存在 → 整棵子树标 only-left", () => {
    const onlyLeft = entries.find((e) => e.kind === "only-left")!;
    expect(onlyLeft.leftRange).toBeDefined();
    const [from, to, cls] = [onlyLeft.leftRange![0], onlyLeft.leftRange![1], "cm-diff-only-left"];
    const aNode = root.children.find((c) => c.key === "a")!;
    expect(pickMark(aNode.start, aNode.end, [{ from, to, className: cls }])).toBe(cls);
    // 子树 x 也整块被标
    expect(pickMark(aNode.children[0].start, aNode.children[0].end, [{ from, to, className: cls }])).toBe(cls);
  });

  it("值不同 → 命中该值 span", () => {
    const changed = entries.find((e) => e.path === "c")!;
    const cNode = root.children.find((c) => c.key === "c")!;
    expect(pickMark(cNode.start, cNode.end, [{ from: changed.leftRange![0], to: changed.leftRange![1], className: "cm-diff-changed" }])).toBe("cm-diff-changed");
  });

  it("无关 span 不命中", () => {
    expect(pickMark(0, 1, [{ from: 5, to: 8, className: "x" }])).toBeUndefined();
  });
});
