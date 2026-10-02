/**
 * 命令面板的极简模糊匹配：零依赖。
 * 子串命中直接给高分；否则做子序列匹配，连续命中与词首命中加分，间隙扣分。
 */
export function fuzzyScore(query: string, target: string): number | null {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = target.toLowerCase();

  const substring = t.indexOf(q);
  if (substring !== -1) {
    // 越靠前、越接近词首越好
    const wordStart = substring === 0 || /[\s\-_/·]/.test(t[substring - 1] ?? "");
    return 100 - substring + (wordStart ? 20 : 0) + (substring === 0 ? 10 : 0);
  }

  let score = 0;
  let ti = 0;
  let streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    streak = found === ti ? streak + 1 : 0;
    score += 5 + streak * 3 - Math.min(found - ti, 8);
    if (found === 0 || /[\s\-_/·]/.test(t[found - 1] ?? "")) score += 6;
    ti = found + 1;
  }
  return Math.max(score, 1);
}
