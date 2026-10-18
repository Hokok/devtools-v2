import { describe, expect, it } from "vitest";
import { errorPosition, formatJson, jsonDefaults } from "../src/tools/json-formatter/transform";

describe("formatJson", () => {
  it("2 空格缩进美化", () => {
    const r = formatJson('{"a":1,"b":[1,2]}', { ...jsonDefaults });
    expect(r.output).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
  });

  it("压缩为一行", () => {
    const r = formatJson('{ "a" : 1 }', { ...jsonDefaults, indentMode: "minify" });
    expect(r.output).toBe('{"a":1}');
  });

  it("键排序递归生效，数组顺序不变", () => {
    const r = formatJson('{"b":2,"a":{"d":4,"c":[3,1,2]}}', {
      ...jsonDefaults,
      sortKeys: true,
      indentMode: "minify",
    });
    expect(r.output).toBe('{"a":{"c":[3,1,2],"d":4},"b":2}');
  });

  it("转义非 ASCII", () => {
    const r = formatJson('{"名":"值"}', { ...jsonDefaults, indentMode: "minify", ensureAscii: true });
    expect(r.output).toBe('{"\\u540d":"\\u503c"}');
  });

  it("去转义默认开启：转义的 JSON 文档反转义后格式化", () => {
    const encoded = JSON.stringify(JSON.stringify({ a: 1, b: [1, 2] }));
    const r = formatJson(encoded, { ...jsonDefaults });
    expect(r.output).toBe('{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}');
  });

  it("去转义限深 5 层，多重转义也能剥开", () => {
    let encoded = JSON.stringify({ a: 1 });
    for (let i = 0; i < 3; i++) encoded = JSON.stringify(encoded);
    const r = formatJson(encoded, { ...jsonDefaults, indentMode: "minify" });
    expect(r.output).toBe('{"a":1}');
  });

  it("关闭去转义后保持字符串字面量", () => {
    const encoded = JSON.stringify(JSON.stringify({ a: 1 }));
    const r = formatJson(encoded, { ...jsonDefaults, unescape: false, indentMode: "minify" });
    expect(r.output).toBe(encoded);
  });

  it("去转义不碰标量字符串", () => {
    expect(formatJson('"hello"', { ...jsonDefaults }).output).toBe('"hello"');
    expect(formatJson('"123"', { ...jsonDefaults }).output).toBe('"123"');
  });

  it("非法 JSON 报错（行号取决于引擎是否提供位置信息）", () => {
    // V8 新版已不输出 position；JSC/SpiderMonkey 输出 line N。行号提取有则用，无则不阻塞报错本身。
    const r = formatJson('{\n  "a": 1,\n  "b": ,\n}', { ...jsonDefaults });
    expect(r.error).toBeDefined();
    expect(r.error?.message).toMatch(/JSON/i);
    if (r.error?.line !== undefined) expect(r.error.line).toBe(3);
  });

  describe("errorPosition：从报错文案还原位置", () => {
    const input = '{\n  "a": 1,\n  "b": ,\n  "c": 3\n}';

    it("新版 V8 片段（带引号包裹）反查位置 → 第 3 行", () => {
      const message = `Unexpected token ',', ..."1,\n  "b": ,\n  "c": 3"... is not valid JSON`;
      const pos = errorPosition(message, input);
      expect(pos).toBe(19);
      expect(input.slice(0, pos!).split("\n")).toHaveLength(3);
    });

    it("旧版 V8 的 at position N", () => {
      expect(errorPosition("Unexpected token } in JSON at position 19", input)).toBe(19);
    });

    it("无位置信息时返回 undefined（JSC 风格）", () => {
      expect(errorPosition("JSON Parse error: Unexpected token ','", input)).toBeUndefined();
    });

    it("片段贴开头：窗口起点为 0，位置 = 片段长度 - 10", () => {
      const short = "nope-not-json";
      // pos=2 时窗口为 [0, 12)，片段正好是 input.slice(0,12)
      const pos = errorPosition(`Unexpected token 'o', ..."nope-not-jso"... is not valid JSON`, short);
      expect(pos).toBe(2);
    });

    it("片段与原文对不上时返回 undefined，不误报行号", () => {
      expect(errorPosition('Unexpected token, ..."不存在"... is not valid JSON', input)).toBeUndefined();
    });
  });

  it("空输入静默返回", () => {
    expect(formatJson("   ", { ...jsonDefaults })).toEqual({});
  });
});
