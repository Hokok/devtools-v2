import { describe, expect, it } from "vitest";
import { foldPlaceholderText, jsonFoldInfo } from "../src/tools/json-common/fold";

describe("jsonFoldInfo：折叠 range → 容器与计数", () => {
  const text = '{\n  "a": {\n    "x": 1,\n    "y": [1, 2, 3]\n  },\n  "b": []\n}\n';

  it("对象折叠：直接子项数", () => {
    // 根 { 的位置 0，收在末 } 之前
    expect(jsonFoldInfo(text, 0, text.indexOf("}"))).toEqual({ kind: "object", count: 2 });
    // 内层 a 的对象
    const aFrom = text.indexOf("{", text.indexOf('"a"'));
    const aTo = text.indexOf("}", aFrom);
    expect(jsonFoldInfo(text, aFrom, aTo)).toEqual({ kind: "object", count: 2 });
  });

  it("数组折叠：元素个数；空容器折叠数 0", () => {
    const yFrom = text.indexOf("[");
    const yTo = text.indexOf("]", yFrom);
    expect(jsonFoldInfo(text, yFrom, yTo)).toEqual({ kind: "array", count: 3 });
    expect(jsonFoldInfo(text, text.indexOf("[]"), text.indexOf("[]") + 1)).toEqual({
      kind: "array",
      count: 0,
    });
  });

  it("range 落在标量上回落到所属容器；整段文本给根", () => {
    // 折叠 range 只会是容器边界；标量 range 按其所属容器计数（文档化行为）
    expect(jsonFoldInfo(text, text.indexOf("1, 2, 3"), text.indexOf("1, 2, 3") + 3)).toEqual({
      kind: "array",
      count: 3,
    });
    expect(jsonFoldInfo(text, 0, text.length - 1)).toEqual({ kind: "object", count: 2 });
    expect(jsonFoldInfo("不 legal", 0, 2)).toBeUndefined();
  });
});

describe("foldPlaceholderText：占位符文案", () => {
  it("容器给「… N 项」（大括号保留）", () => {
    const text = "[0,1,2]";
    expect(foldPlaceholderText(text, 0, text.length - 1)).toBe("… 3 项");
    expect(foldPlaceholderText('{"a":1,"b":2}', 0, 11)).toBe("… 2 项");
  });

  it("空容器计… 0 项，非 JSON 回落 …", () => {
    expect(foldPlaceholderText("[]", 0, 1)).toBe("… 0 项");
    expect(foldPlaceholderText("oops", 0, 2)).toBe("…");
  });
});
