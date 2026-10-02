import type { SettingField, TransformResult, ToolSettings } from "../../platform/types";

export const urlDefaults = {
  mode: "encode", // "encode" | "decode"
  component: true, // encodeURIComponent（含 = & ? 等保留字）vs encodeURI
};

export const urlSchema: SettingField[] = [
  {
    type: "select",
    key: "mode",
    label: "方向",
    default: urlDefaults.mode,
    options: [
      { value: "encode", label: "编码（文本 → URL）" },
      { value: "decode", label: "解码（URL → 文本）" },
    ],
  },
  {
    type: "toggle",
    key: "component",
    label: "组件模式",
    hint: "编码时连 = ? & / 一并转义；解码模式下两种格式都能识别",
    default: urlDefaults.component,
    visibleWhen: { key: "mode", equals: "encode" },
  },
];

export function urlCodec(input: string, s: ToolSettings): TransformResult {
  if (!input) return {};
  try {
    if (s.mode === "decode") {
      return { output: s.component ? decodeURIComponent(input) : decodeURI(input) };
    }
    return { output: s.component ? encodeURIComponent(input) : encodeURI(input) };
  } catch {
    return { error: { message: "含有格式不正确的百分号序列（如孤立的 %）" } };
  }
}
