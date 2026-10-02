import { describe, expect, it } from "vitest";
import { timestampConvert, timestampDefaults } from "../src/tools/timestamp/transform";
import { generateUuids, uuidDefaults } from "../src/tools/uuid/transform";

describe("timestampConvert", () => {
  it("秒级时间戳（自动识别）→ ISO", () => {
    const r = timestampConvert("1791000000", { ...timestampDefaults });
    expect(r.output).toMatch(/2026-10-03T04:00:00\.000Z/);
  });

  it("毫秒级时间戳（自动识别）", () => {
    const r = timestampConvert("1791000000000", { ...timestampDefaults });
    expect(r.output).toMatch(/2026-10-03T04:00:00\.000Z/);
  });

  it("日期字符串 → 时间戳", () => {
    const r = timestampConvert("2026-10-02T22:40:00Z", { ...timestampDefaults });
    expect(r.output).toContain("1790980800000");
  });

  it("强制按秒解释毫秒级数字", () => {
    const r = timestampConvert("1791000000", { ...timestampDefaults, unit: "ms" });
    expect(r.output).toMatch(/1970-01-21T17:30:00\.000Z/);
  });

  it("无法识别的输入报错", () => {
    expect(timestampConvert("明天下午", { ...timestampDefaults }).error).toBeDefined();
  });

  it("空输入显示当前时间", () => {
    const r = timestampConvert("", { ...timestampDefaults });
    expect(r.output).toBeDefined();
    expect(r.output).toMatch(/Unix 秒/);
  });
});

describe("generateUuids", () => {
  it("数量与大写", () => {
    const r = generateUuids("", { ...uuidDefaults, count: 3, uppercase: true });
    const lines = (r.output ?? "").split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(lines[0].toUpperCase());
  });

  it("符合 v4 格式（版本位与变体位）", () => {
    const r = generateUuids("", { ...uuidDefaults, count: 10 });
    for (const line of (r.output ?? "").split("\n")) {
      expect(line).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it("数量越界收敛到 [1, 500]", () => {
    expect(generateUuids("", { ...uuidDefaults, count: 0 }).output).toMatch(/^[0-9a-f-]{36}$/);
  });
});
