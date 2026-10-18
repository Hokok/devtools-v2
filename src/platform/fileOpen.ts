/**
 * 文件载入适配器（见 CONTEXT.md：文件载入）。
 * Tauri 内走系统「打开」对话框（官方 dialog/fs 插件——用户在对话框选中的路径
 * 由 dialog 插件自动加入 fs 范围，无需预授权）；浏览器 dev 模式回退 <input type="file">。
 * 一律按 UTF-8 文本读入；用户取消返回 null。
 */

import type { FileFilter } from "./saveFile";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface LoadedFile {
  name: string;
  text: string;
}

export const DEFAULT_TEXT_FILTERS: FileFilter[] = [
  {
    name: "文本文件",
    extensions: ["txt", "json", "xml", "csv", "md", "log", "yml", "yaml", "js", "ts", "html"],
  },
  { name: "所有文件", extensions: ["*"] },
];

/** 从路径取文件名（兼容 Windows 反斜杠） */
export function baseName(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

/** 弹系统对话框选一个文本文件读入 */
export async function openTextFile(filters: FileFilter[] = DEFAULT_TEXT_FILTERS): Promise<LoadedFile | null> {
  if (isTauri) {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const selected = (await open({ multiple: false, directory: false, filters })) as
      | string
      | { path: string }
      | null;
    const path = typeof selected === "string" ? selected : (selected?.path ?? null);
    if (!path) return null;
    return { name: baseName(path), text: await readTextFile(path) };
  }
  return pickFileInBrowser();
}

/** 拖拽进来的浏览器 File 直接读文本（Tauri 下需 webview dragDropEnabled=false） */
export async function readDroppedFile(file: File): Promise<LoadedFile> {
  return { name: file.name, text: await file.text() };
}

function pickFileInBrowser(): Promise<LoadedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,.json,.xml,.csv,.md,.log,.yml,.yaml,text/*";
    input.style.display = "none";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) resolve(null);
      else void file.text().then((text) => resolve({ name: file.name, text }));
    });
    // 现代浏览器取消选择会派发 cancel，避免 Promise 悬空
    input.addEventListener("cancel", () => {
      input.remove();
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}
