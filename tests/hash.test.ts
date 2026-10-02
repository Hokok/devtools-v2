import { describe, expect, it } from "vitest";
import { hash, hashDefaults } from "../src/tools/hash/transform";
import { md5 } from "../src/tools/hash/md5";

describe("md5", () => {
  it("RFC 1321 标准测试向量", () => {
    expect(md5("")).toBe("d41d8cd98f00b204e9800998ecf8427e");
    expect(md5("a")).toBe("0cc175b9c0f1b6a831c399e269772661");
    expect(md5("abc")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(md5("message digest")).toBe("f96b697d7cb7938d525a2f31aaf161d0");
    expect(md5("abcdefghijklmnopqrstuvwxyz")).toBe("c3fcd3d76192e4007dfb496cca67e13b");
  });

  it("跨 64 字节块边界正确（多块消息）", () => {
    expect(md5("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")).toBe(
      "d174ab98d277d9f5a5611c2c9f419d9f",
    );
  });
});

describe("hash", () => {
  it("SHA-256 标准向量", async () => {
    const r = await hash("abc", { ...hashDefaults, algo: "sha256" });
    expect(r.output).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });

  it("SHA-512 与大写输出", async () => {
    const r = await hash("abc", { ...hashDefaults, algo: "sha512", uppercase: true });
    expect(r.output).toBe(
      "DDAF35A193617ABACC417349AE20413112E6FA4E89A97EA20A9EEEE64B55D39A2192992A274FC1A836BA3C23A3FEEBBD454D4423643CE80E2A9AC94FA54CA49F",
    );
  });
});
