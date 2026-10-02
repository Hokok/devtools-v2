import type { SettingField, TransformResult, ToolSettings } from "../../platform/types";
import { md5 } from "./md5";

export const hashDefaults = {
  algo: "sha256", // "md5" | "sha1" | "sha256" | "sha512"
  uppercase: false,
};

export const hashSchema: SettingField[] = [
  {
    type: "select",
    key: "algo",
    label: "算法",
    default: hashDefaults.algo,
    options: [
      { value: "md5", label: "MD5" },
      { value: "sha1", label: "SHA-1" },
      { value: "sha256", label: "SHA-256" },
      { value: "sha512", label: "SHA-512" },
    ],
  },
  {
    type: "toggle",
    key: "uppercase",
    label: "大写输出",
    default: hashDefaults.uppercase,
  },
];

const WEB_CRYPTO_NAMES: Record<string, string> = {
  sha1: "SHA-1",
  sha256: "SHA-256",
  sha512: "SHA-512",
};

/** 异步纯函数：WebCrypto 只支持 SHA 系，MD5 走本地实现。 */
export async function hash(input: string, s: ToolSettings): Promise<TransformResult> {
  const algo = String(s.algo);
  let hex: string;

  if (algo === "md5") {
    hex = md5(input);
  } else if (algo in WEB_CRYPTO_NAMES) {
    const digest = await crypto.subtle.digest(WEB_CRYPTO_NAMES[algo], new TextEncoder().encode(input));
    hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  } else {
    return { error: { message: `不支持的算法: ${algo}` } };
  }

  return { output: s.uppercase ? hex.toUpperCase() : hex };
}
