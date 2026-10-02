import type { SettingField, TransformResult, ToolSettings } from "../../platform/types";

export const base64Defaults = {
  mode: "encode", // "encode" | "decode"
  urlSafe: false,
};

export const base64Schema: SettingField[] = [
  {
    type: "select",
    key: "mode",
    label: "方向",
    default: base64Defaults.mode,
    options: [
      { value: "encode", label: "编码（文本 → Base64）" },
      { value: "decode", label: "解码（Base64 → 文本）" },
    ],
  },
  {
    type: "toggle",
    key: "urlSafe",
    label: "URL 安全",
    hint: "使用 - _ 替代 + /（解码时自动兼容两种字母表）",
    default: base64Defaults.urlSafe,
    visibleWhen: { key: "mode", equals: "encode" },
  },
];

/** 纯函数：UTF-8 安全的 Base64 编解码。 */
export function base64Codec(input: string, s: ToolSettings): TransformResult {
  if (!input) return {};

  if (s.mode === "decode") {
    try {
      return { output: decode(input) };
    } catch {
      return { error: { message: "不是有效的 Base64 字符串" } };
    }
  }

  const bytes = new TextEncoder().encode(input);
  let output = bytesToBase64(bytes);
  if (s.urlSafe) output = output.replaceAll("+", "-").replaceAll("/", "_");
  return { output };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000; // 分块转换，避免大输入时展开参数栈溢出
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

/** 兼容标准与 URL 安全字母表，容忍缺失的 = 填充与空白符 */
function decode(input: string): string {
  const normalized = input
    .replace(/[\s]/g, "")
    .replaceAll("-", "+")
    .replaceAll("_", "/")
    .replace(/=+$/, "");
  if (/[^\dA-Za-z+/]/.test(normalized)) {
    throw new Error("invalid base64");
  }
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
