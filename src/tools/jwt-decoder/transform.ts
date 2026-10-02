import type { SettingField, TransformResult, ToolSettings } from "../../platform/types";
import { texts } from "./texts";

export const jwtDefaults = {
  showClaimNotes: true, // exp / iat 等时间字段附加人类可读说明
};

export const jwtSchema: SettingField[] = [
  {
    type: "toggle",
    key: "showClaimNotes",
    label: "时间字段说明",
    hint: "对 exp / iat / nft 附加本地时间与剩余有效期",
    default: jwtDefaults.showClaimNotes,
  },
];

const L = texts.labels;

export function decodeJwt(input: string, s: ToolSettings): TransformResult {
  const token = input.trim();
  if (!token) return {};

  const parts = token.split(".");
  if (parts.length < 2 || parts.length > 3 || parts.some((p, i) => i < 2 && !p)) {
    return { error: { message: "不是有效的 JWT：应为 header.payload[.signature] 三段式" } };
  }

  let header: unknown;
  let payload: Record<string, unknown>;
  try {
    header = JSON.parse(b64urlDecode(parts[0]));
    payload = JSON.parse(b64urlDecode(parts[1]));
    if (header === null || typeof header !== "object" || payload === null || typeof payload !== "object") {
      throw new Error("not an object");
    }
  } catch {
    return { error: { message: "JWT 段无法解码或不是 JSON 对象（请确认没有粘贴多行或截断的 token）" } };
  }

  const sections: string[] = [
    `── HEADER ──\n${JSON.stringify(header, null, 2)}`,
    `── PAYLOAD ──\n${JSON.stringify(payload, null, 2)}`,
  ];

  if (parts[2] !== undefined) {
    sections.push(`── SIGNATURE ──\n${parts[2]}\n（未验证。签名校验需要服务端密钥）`);
  } else {
    sections.push(`── SIGNATURE ──\n（无签名的未安全令牌）`);
  }

  if (s.showClaimNotes) {
    const notes: string[] = [];
    for (const key of ["exp", "iat", "nbf"] as const) {
      const v = payload[key];
      if (typeof v === "number") {
        const d = new Date(v * 1000);
        notes.push(`${key}: ${d.toLocaleString()}${expNote(key, v)}`);
      }
    }
    if (notes.length > 0) sections.push(`── 时间字段 ──\n${notes.join("\n")}`);
  }

  return { output: sections.join("\n\n") };

  function expNote(key: string, v: number): string {
    if (key !== "exp") return "";
    const diff = v * 1000 - Date.now();
    if (diff <= 0) return L.expired;
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 60) return L.expiresIn(minutes);
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return L.expiresInHours(hours);
    return L.expiresInDays(Math.floor(hours / 24));
  }
}

function b64urlDecode(segment: string): string {
  const normalized = segment.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
