import { describe, expect, it } from "vitest";
import { decodeJwt, jwtDefaults } from "../src/tools/jwt-decoder/transform";

function makeToken(header: object, payload: object, signature = "sig"): string {
  // UTF-8 安全的 base64url（btoa 只接受 Latin1，中文需先过 TextEncoder）
  const enc = (o: object) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    let binary = "";
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  };
  return `${enc(header)}.${enc(payload)}.${signature}`;
}

describe("decodeJwt", () => {
  it("解码 header/payload 并标注签名", () => {
    const token = makeToken({ alg: "HS256", typ: "JWT" }, { sub: "u1", name: "测试" });
    const r = decodeJwt(token, { ...jwtDefaults });
    expect(r.output).toContain('"alg": "HS256"');
    expect(r.output).toContain('"name": "测试"');
    expect(r.output).toContain("sig");
  });

  it("exp 字段给出时间说明", () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const token = makeToken({ alg: "HS256" }, { exp: future });
    const r = decodeJwt(token, { ...jwtDefaults });
    expect(r.output).toContain("exp:");
    expect(r.output).toMatch(/剩余/);
  });

  it("两段式（无签名）token 也能解析", () => {
    const token = makeToken({ alg: "none" }, { sub: "u1" }).split(".").slice(0, 2).join(".");
    const r = decodeJwt(token, { ...jwtDefaults });
    expect(r.output).toContain("未安全令牌");
  });

  it("非 JWT 输入报错", () => {
    expect(decodeJwt("not-a-jwt", { ...jwtDefaults }).error).toBeDefined();
    expect(decodeJwt("a.b.c.d", { ...jwtDefaults }).error).toBeDefined();
  });

  it("空输入静默返回", () => {
    expect(decodeJwt("", { ...jwtDefaults })).toEqual({});
  });
});
