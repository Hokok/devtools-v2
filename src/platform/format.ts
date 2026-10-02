/** 小型格式化工具：字节/字符计数的人话显示。 */
export function fmtCount(text: string): string {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes < 1024) return `${text.length} 字符`;
  if (bytes < 1024 * 1024) return `${text.length} 字符 · ${(bytes / 1024).toFixed(1)} KB`;
  return `${text.length} 字符 · ${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function fmtMs(ms: number): string {
  if (ms < 1) return "<1ms";
  if (ms < 100) return `${ms.toFixed(0)}ms`;
  return `${ms.toFixed(0)}ms`;
}
