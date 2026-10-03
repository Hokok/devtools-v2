import { describe, expect, it } from "vitest";
import { diffJson, ROOT_PATH } from "../src/tools/json-diff/diff";

const shapes = (r: ReturnType<typeof diffJson>) =>
  r.entries.map((e) => ({ path: e.path, kind: e.kind }));

describe("diffJson", () => {
  it("对象 key 增删：仅左/仅右，高亮范围覆盖整个键值对", () => {
    const left = '{"a":1,"b":2}';
    const right = '{"a":1,"c":3}';
    const r = diffJson(left, right);
    expect(shapes(r)).toEqual([
      { path: "b", kind: "only-left" },
      { path: "c", kind: "only-right" },
    ]);
    const bEntry = r.entries[0];
    expect(left.slice(...bEntry.leftRange!)).toBe('"b":2');
    const cEntry = r.entries[1];
    expect(right.slice(...cEntry.rightRange!)).toBe('"c":3');
  });

  it("标量值不同 → changed", () => {
    const r = diffJson('{"a":1}', '{"a":2}');
    expect(shapes(r)).toEqual([{ path: "a", kind: "changed" }]);
  });

  it("宽松比较：类型不同不算差异", () => {
    expect(diffJson('{"a":1}', '{"a":"1"}').entries).toEqual([]);
    expect(diffJson('{"a":true}', '{"a":"true"}').entries).toEqual([]);
    expect(diffJson('{"a":null}', '{"a":"null"}').entries).toEqual([]);
    expect(diffJson('{"a":1}', '{"a":1.0}').entries).toEqual([]);
  });

  it("宽松比较不越界：结构仍按结构比", () => {
    // "1" 与 1 相同，但对象与标量形状不同 → changed
    expect(shapes(diffJson('{"a":{"x":1}}', '{"a":1}'))).toEqual([{ path: "a", kind: "changed" }]);
  });

  it("数组整体标记：内部有差异只记一条，范围覆盖整个数组", () => {
    const left = '{"a":[1,2],"keep":1}';
    const right = '{"a":[1,3],"keep":1}';
    const r = diffJson(left, right);
    expect(shapes(r)).toEqual([{ path: "a", kind: "changed" }]);
    expect(left.slice(...r.entries[0].leftRange!)).toBe("[1,2]");
    expect(right.slice(...r.entries[0].rightRange!)).toBe("[1,3]");
  });

  it("数组顺序不同 → 整块 changed（不做元素对齐）", () => {
    expect(shapes(diffJson('{"a":[1,2]}', '{"a":[2,1]}'))).toEqual([{ path: "a", kind: "changed" }]);
    expect(diffJson('{"a":[1,2]}', '{"a":[1,2]}').entries).toEqual([]);
  });

  it("key 顺序与缩进空白不影响结果", () => {
    expect(diffJson('{"a":1,\n  "b":2}', '{"b":2,"a":1}').entries).toEqual([]);
  });

  it("类型不同（对象 vs 数组）→ changed", () => {
    expect(shapes(diffJson('{"a":{"x":1}}', '{"a":[1]}'))).toEqual([{ path: "a", kind: "changed" }]);
  });

  it("嵌套路径逐级下钻", () => {
    const r = diffJson('{"a":{"b":{"c":1}}}', '{"a":{"b":{"c":2,"d":3}}}');
    expect(shapes(r)).toEqual([
      { path: "a.b.c", kind: "changed" },
      { path: "a.b.d", kind: "only-right" },
    ]);
  });

  it("根级别比较", () => {
    expect(shapes(diffJson("1", "2"))).toEqual([{ path: ROOT_PATH, kind: "changed" }]);
    expect(diffJson("1", "1").entries).toEqual([]);
    expect(shapes(diffJson("[1]", '{"a":1}'))).toEqual([{ path: ROOT_PATH, kind: "changed" }]);
  });

  it("解析失败：报告出错的一侧与行号", () => {
    const r = diffJson('{\n  "a": 1,\n  "b": ,\n}', '{"a":1}');
    expect(r.leftError).toBeDefined();
    expect(r.leftError?.line).toBe(3);
    expect(r.rightError).toBeUndefined();
    expect(r.entries).toEqual([]);
  });

  it("一侧为空：提示内容为空；两侧全空：静默", () => {
    const r = diffJson('{"a":1}', "");
    expect(r.rightError?.message).toBe("内容为空");
    expect(diffJson("", "").entries).toEqual([]);
  });
});
