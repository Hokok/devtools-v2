/** 小型格式化工具：字节/字符计数的人话显示。 */
export function fmtCount(text: string): string {
  const bytes = new TextEncoder().encode(text).length;
  if (bytes < 1024) return `${text.length} 字符`;
  if (bytes < 1024 * 1024) return `${text.length} 字符 · ${(bytes / 1024).toFixed(1)} KB`;
  return `${text.length} 字符 · ${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function fmtMs(ms: number): string {
  if (ms < 1) return "<1ms";
  return `${ms.toFixed(0)}ms`;
}

/** 相对时间（会话历史的「刚刚 / N 分钟前」） */
export function fmtAgo(at: number, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 45) return "刚刚";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${Math.max(1, minutes)} 分钟前`;
  const hours = Math.round(minutes / 60);
  return `${hours} 小时前`;
}
