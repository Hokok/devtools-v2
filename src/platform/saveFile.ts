/**
 * 文件保存适配器：Tauri 内走系统「另存为」对话框（官方 dialog/fs 插件，
 * 用户在对话框选中的路径由 dialog 插件自动加入 fs 范围，无需预授权）；
 * 浏览器 dev 模式回退 Blob 下载。
 * 返回保存路径（浏览器下为文件名）；用户取消返回 null。
 */

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export interface FileFilter {
  name: string;
  extensions: string[];
}

export async function saveTextFile(
  content: string,
  fileName: string,
  filters?: FileFilter[],
): Promise<string | null> {
  if (isTauri) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: fileName, filters });
    if (!path) return null;
    await writeTextFile(path, content);
    return path;
  }
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return fileName;
}
