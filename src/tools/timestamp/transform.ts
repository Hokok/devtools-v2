import type { SettingField, TransformResult, ToolSettings } from "../../platform/types";
import { texts } from "./texts";

export const timestampDefaults = {
  unit: "auto", // "auto" | "s" | "ms" —— 数字输入按此单位解释
};

export const timestampSchema: SettingField[] = [
  {
    type: "select",
    key: "unit",
    label: "数字单位",
    hint: "输入是纯数字时，按该单位解释；自动 = 绝对值大于 1e12 视为毫秒",
    default: timestampDefaults.unit,
    options: [
      { value: "auto", label: "自动识别" },
      { value: "s", label: "按秒解释" },
      { value: "ms", label: "按毫秒解释" },
    ],
  },
];

const L = texts.labels;

/** 纯函数：双向转换。输入为空时展示当前时刻（每 1s 由 UI 侧重触发）。 */
export function timestampConvert(input: string, s: ToolSettings): TransformResult {
  const trimmed = input.trim();
  let date: Date | null = null;

  if (!trimmed) {
    date = new Date();
  } else if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const n = Number(trimmed);
    const isMs =
      s.unit === "ms" || (s.unit === "auto" && Math.abs(n) > 1e12);
    date = new Date(isMs ? n : n * 1000);
  } else {
    const parsed = new Date(trimmed.replace(" ", "T"));
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }

  if (!date || Number.isNaN(date.getTime())) {
    return { error: { message: "无法识别的时间格式：请输入时间戳或标准日期字符串" } };
  }

  const t = date.getTime();
  const diff = t - Date.now();
  const output = [
    `${L.sec}:     ${Math.floor(t / 1000)}`,
    `${L.ms}:    ${t}`,
    `${L.iso}:   ${date.toISOString()}`,
    `${L.local}:  ${formatLocal(date)}`,
    `${L.weekday}:   ${L.weekdays[date.getDay()]}`,
    `${L.relative}:   ${relative(diff)}`,
  ].join("\n");

  return { output };
}

function formatLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function relative(diffMs: number): string {
  const abs = Math.abs(diffMs);
  const suffix = diffMs >= 0 ? L.later : L.ago;
  if (abs < 60_000) return L.now;
  if (abs < 3_600_000) return `${Math.floor(abs / 60_000)} ${L.minutes}${suffix}`;
  if (abs < 86_400_000) return `${Math.floor(abs / 3_600_000)} ${L.hours}${suffix}`;
  return `${Math.floor(abs / 86_400_000)} ${L.days}${suffix}`;
}
