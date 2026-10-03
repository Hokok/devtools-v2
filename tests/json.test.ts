import { describe, expect, it } from "vitest";
import { formatJson, jsonDefaults } from "../src/tools/json-formatter/transform";

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

  it("空输入静默返回", () => {
    expect(formatJson("   ", { ...jsonDefaults })).toEqual({});
  });
});
