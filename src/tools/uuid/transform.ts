import type { SettingField, TransformResult, ToolSettings } from "../../platform/types";

export const uuidDefaults = {
  count: 5,
  uppercase: false,
};

export const uuidSchema: SettingField[] = [
  {
    type: "number",
    key: "count",
    label: "生成数量",
    default: uuidDefaults.count,
    min: 1,
    max: 500,
  },
  {
    type: "toggle",
    key: "uppercase",
    label: "大写输出",
    default: uuidDefaults.uppercase,
  },
];

export function generateUuids(_input: string, s: ToolSettings): TransformResult {
  const count = clamp(Number(s.count) || 1, 1, 500);
  const list: string[] = [];
  for (let i = 0; i < count; i++) {
    let id = uuidV4();
    if (s.uppercase) id = id.toUpperCase();
    list.push(id);
  }
  return { output: list.join("\n") };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** 基于 crypto.getRandomValues 的 v4 实现，兼容所有 WebView（不依赖 randomUUID） */
function uuidV4(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10x
  let hex = "";
  for (const byte of b) hex += byte.toString(16).padStart(2, "0");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
