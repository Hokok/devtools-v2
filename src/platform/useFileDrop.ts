import { useEffect, useState } from "react";

/**
 * 窗口级文件拖拽（见 CONTEXT.md：文件载入）。
 *
 * 只接管**文件**拖拽——纯文本拖放交给 CodeMirror/原生处理，避免和编辑器抢事件。
 * 需 Tauri 侧 `dragDropEnabled: false`，否则系统级拖放拦截会让 WebView 收不到
 * 这些 DOM 拖拽事件（见 tauri.conf.json 注释）。
 * dragenter/dragleave 会随子元素反复触发，用进入计数避免遮罩闪烁。
 */
export function useDragDropFiles(onDrop: (file: File) => void): boolean {
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let depth = 0;

    const hasFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types?.includes("Files"));

    const onDragEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth += 1;
      if (depth === 1) setDragging(true);
    };

    const onDragOver = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    };

    const onDragLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };

    const handleDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) onDrop(file);
    };

    window.addEventListener("dragenter", onDragEnter);
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", handleDrop);
    return () => {
      window.removeEventListener("dragenter", onDragEnter);
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [onDrop]);

  return dragging;
}
