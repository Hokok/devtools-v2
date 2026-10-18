/** 剪贴板适配器：Tauri 内用官方插件（WebView 权限模型更可控），浏览器用标准 API。 */

import { useClipboardHistory } from "./stores/clipboardHistory";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** 写入系统剪贴板，同时留档到应用内剪贴板历史（见 CONTEXT.md） */
export async function copyText(text: string): Promise<void> {
  if (isTauri) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    await writeText(text);
  } else {
    await navigator.clipboard.writeText(text);
  }
  useClipboardHistory.getState().record(text);
}

export async function readText(): Promise<string> {
  if (isTauri) {
    const { readText } = await import("@tauri-apps/plugin-clipboard-manager");
    return await readText();
  }
  return await navigator.clipboard.readText();
}
