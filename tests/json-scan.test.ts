import { describe, expect, it } from "vitest";
import { findJsonErrorOffset, lineAt, parseSpans, ScanError } from "../src/tools/json-common/scan";

/** 出错偏移落在第几行——这就是三个 JSON 工具"错误行号点击跳转"依赖的东西 */
function errorLine(text: string): number | undefined {
  const offset = findJsonErrorOffset(text);
  return offset === undefined ? undefined : lineAt(text, offset);
}

describe("JSON 扫描：合法输入", () => {
  it.each([
    "{}",
    "[]",
    "null",
    "42",
    "-1.5e3",
    '"text"',
    '{"a":1,"b":[1,2,{"c":null}],"d":"\\u4f60\\u597d"}',
    '  {\n  "a": 1\n}\n',
    '[{"a":[]},{"b":{}}]',
  ])("%s 无错误", (text) => {
    expect(findJsonErrorOffset(text)).toBeUndefined();
  });

  it("parseSpans 产出可用 span（偏移对应原文）", () => {
    const text = '{"a": 1}';
    const node = parseSpans(text);
    expect(node.kind).toBe("object");
    if (node.kind !== "object") return;
    expect(node.props[0].key).toBe("a");
    expect(text.slice(node.props[0].keyStart, node.props[0].keyEnd)).toBe('"a"');
    expect(node.props[0].value.start).toBe(text.indexOf("1"));
  });
});

describe("JSON 扫描：报错位置与引擎无关", () => {
  it("缺值（尾部多余逗号）", () => {
    expect(errorLine('{\n  "a": 1,\n  "b": ,\n  "c": 3\n}')).toBe(3);
  });

  it("字符串未闭合 → 末行", () => {
    expect(errorLine('{\n  "a": "unterminated\n}')).toBe(3);
  });

  it("对象里缺冒号", () => {
    expect(errorLine('{\n  "a" 1\n}')).toBe(2);
  });

  it("key 没加引号", () => {
    expect(errorLine('{\n  a: 1\n}')).toBe(2);
  });

  it("数组里缺逗号", () => {
    expect(errorLine("[1 2]")).toBe(1);
  });

  it("值之后存在多余内容", () => {
    expect(errorLine('{"a":1} trailing')).toBe(1);
    expect(errorLine("1 2")).toBe(1);
  });

  it("应为值（裸词、加号、单个小数点）", () => {
    expect(errorLine("nope")).toBe(1);
    expect(errorLine("+1")).toBe(1);
    expect(errorLine(".5")).toBe(1);
  });

  it("前导零：偏移落在多余字符上", () => {
    expect(errorLine("01")).toBe(1);
    expect(findJsonErrorOffset("01")).toBe(1);
  });

  it("空容器合法、孤立闭括号报错", () => {
    expect(errorLine("{}")).toBeUndefined();
    expect(errorLine("}")).toBe(1);
    expect(errorLine("{}]")).toBe(1);
  });

  it("CRLF 也按行计数", () => {
    expect(errorLine('{\r\n  "a": 1,\r\n  "b": ,\r\n}')).toBe(3);
  });
});

describe("JSON 扫描：非法字符串转义不瞎报行号", () => {
  it("非法转义由内层 JSON.parse 抛普通语法错误 → 无偏移（不冒充已定位）", () => {
    // 扫描器对 \X 一律跳 2 字符（宽松），真正的转义合法性交给字符串切片上的 JSON.parse；
    // 那类错误没有可用偏移，宁可没有行号也不要指错地方。
    expect(findJsonErrorOffset('{"a":"\\q"}')).toBeUndefined();
  });
});

describe("JSON 扫描：ScanError 携带偏移", () => {
  it("抛出的错误类型与偏移可用于定位", () => {
    try {
      parseSpans('{"a": }');
      throw new Error("应当抛错");
    } catch (err) {
      expect(err).toBeInstanceOf(ScanError);
      expect((err as ScanError).offset).toBe(6);
    }
  });
});

describe("lineAt", () => {
  it("1 起计数，偏移越界按文本长度截断", () => {
    const text = "a\nb\nc";
    expect(lineAt(text, 0)).toBe(1);
    expect(lineAt(text, 2)).toBe(2);
    expect(lineAt(text, 4)).toBe(3);
    expect(lineAt(text, 999)).toBe(3);
  });
});
