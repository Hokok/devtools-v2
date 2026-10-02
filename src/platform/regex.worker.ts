/// <reference lib="webworker" />
import type { RegexMatch } from "./regexTypes";

const ctx = self as unknown as Worker;

/**
 * 正则匹配专用 Worker：matchAll 可能在病态正则（灾难性回溯）上无限运行，
 * 主线程只负责超时后 terminate 本 Worker——这是 JS 中唯一可靠的中断手段。
 */
ctx.onmessage = (e: MessageEvent<{ id: number; pattern: string; flags: string; input: string }>) => {
  const { id, pattern, flags, input } = e.data;
  try {
    const re = new RegExp(pattern, flags);
    const global = re.global ? re : new RegExp(re.source, `${re.flags}g`);
    const matches: RegexMatch[] = [];
    for (const m of input.matchAll(global)) {
      matches.push({
        text: m[0],
        index: m.index,
        groups: m.slice(1).map((g) => (g === undefined ? null : g)),
        named: m.groups
          ? Object.fromEntries(Object.entries(m.groups).map(([k, v]) => [k, v === undefined ? null : v]))
          : null,
      });
      if (matches.length >= 1000) break;
    }
    ctx.postMessage({ id, matches });
  } catch (err) {
    ctx.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
