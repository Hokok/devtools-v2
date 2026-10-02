import { describe, expect, it } from "vitest";
import { base64Codec, base64Defaults } from "../src/tools/base64/transform";

describe("base64Codec", () => {
  it("编码含中文与 emoji 的 UTF-8 文本", () => {
    const r = base64Codec("开发者 DevTools ✓", { ...base64Defaults });
    // 开发者 的 UTF-8 字节序列的 Base64 前缀
    expect(r.output).toMatch(/^[A-Za-z0-9+/=]+$/);
  });

  it("解码往返无损", () => {
    const text = "Hello, 开发者工具箱! 42 ✓";
    const encoded = base64Codec(text, { ...base64Defaults }).output!;
    const decoded = base64Codec(encoded, { ...base64Defaults, mode: "decode" });
    expect(decoded.output).toBe(text);
  });

  it("URL 安全字母表编解码兼容", () => {
    const text = "subjects?_~<>"; // 会产生 + / 的字节序列
    const encoded = base64Codec(text, { ...base64Defaults, urlSafe: true }).output!;
    expect(encoded).not.toMatch(/[+/]/);
    const decoded = base64Codec(encoded, { ...base64Defaults, mode: "decode" });
    expect(decoded.output).toBe(text);
  });

  it("非法输入报错", () => {
    expect(base64Codec("!!!not-base64!!!", { ...base64Defaults, mode: "decode" }).error).toBeDefined();
  });

  it("空输入静默返回", () => {
    expect(base64Codec("", { ...base64Defaults })).toEqual({});
  });
});
