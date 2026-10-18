/**
 * JSON 提取纯逻辑（2026-10-03 grill 定版）：
 * 定位路径（可选，点路径 + [n] 下标）定位到对象或对象数组 → 按 key 投影成新 JSON；
 * CSV 面向 Excel/WPS 直接打开（见 CONTEXT.md「Excel 兼容 CSV」）：
 * 对象值递归拍平为点路径列，数组值序列化为 JSON 字符串，null/缺失 → 空单元格，
 * 逗号分隔、RFC4180 引号转义、CRLF 行尾、含表头。
 * BOM 不在 csv 字符串里——复制/预览保持干净，导出写盘时再加 CSV_BOM。
 */

import { findJsonErrorOffset, lineAt } from "../json-common/scan";

export const CSV_BOM = "\uFEFF";

export interface ExtractError {
  message: string;
  line?: number;
}

export interface ExtractResult {
  /** 输入 JSON 解析失败 */
  error?: ExtractError;
  /** 定位路径语法错误 / 命中失败 / 形状不符 */
  pathError?: string;
  /** 可选列 = 定位结果的顶层 key 并集（首现顺序） */
  keys: string[];
  /** 投影后的 JSON（保留嵌套结构）；未选列时缺省 */
  json?: string;
  /** CSV 文本（不含 BOM）；未选列时缺省 */
  csv?: string;
  /** CSV 实际列（拍平后的点路径） */
  columns?: string[];
  /** 各行单元格文本（未转义，与 columns 对齐），供表格预览；未选列时缺省 */
  rows?: string[][];
  rowCount?: number;
}

/** 纯函数：定位 + 投影 + 生成 JSON/CSV。可被单测直接调用。
 * valueArray=true 且恰好勾选一列时，输出该列的值数组（如 [1,2,3]）而非对象数组；
 * 手动补充的列可为点路径（含 [n] 下标），按行深层取值，取不到为空。 */
export function extractJson(
  input: string,
  pathText: string,
  selected: string[],
  valueArray = false,
): ExtractResult {
  const trimmed = input.trim();
  if (!trimmed) return { keys: [] };

  // 行号按原文算：trim 掉的头部空白里的换行数补进去
  const lead = input.indexOf(trimmed);
  let leadLines = 0;
  for (let i = 0; i < lead; i++) if (input.charCodeAt(i) === 10) leadLines++;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return { keys: [], error: extractError(err, trimmed, leadLines) };
  }

  const located = resolvePath(parsed, pathText);
  if (!located.ok) return { keys: [], pathError: located.message };
  const target = located.value;

  if (target === null || typeof target !== "object") {
    const where = pathText.trim() ? `定位结果` : "输入";
    return { keys: [], pathError: `${where}需为对象或对象数组，当前是 ${typeName(target)}` };
  }

  const isList = Array.isArray(target);
  const rawRows: unknown[] = isList ? (target as unknown[]) : [target];
  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row === null || typeof row !== "object" || Array.isArray(row)) {
      return { keys: [], pathError: `第 ${i + 1} 项不是对象（${typeName(row)}），无法按列提取` };
    }
  }
  const rows = rawRows as Record<string, unknown>[];

  const keys: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }

  if (selected.length === 0) return { keys };

  const esc = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

  // 值数组模式：恰好一列时输出 [v1, v2, …]，CSV 退化为单列（表头=key）
  if (valueArray && selected.length === 1) {
    const key = selected[0];
    const values = rows.map((row) => {
      const v = valueAt(row, key);
      return v === undefined ? null : v;
    });
    return {
      keys,
      json: JSON.stringify(values, null, 2),
      csv: [esc(key), ...values.map((v) => esc(cellText(v)))].join("\r\n"),
      columns: [key],
      rows: values.map((v) => [cellText(v)]),
      rowCount: values.length,
    };
  }

  const projected = rows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const key of selected) {
      const v = valueAt(row, key);
      if (v !== undefined) out[key] = v;
    }
    return out;
  });
  const json = JSON.stringify(isList ? projected : projected[0], null, 2);

  // CSV：逐行算单元格（拍平即得列名），列 = 各行单元格键的并集（保持选中顺序）
  const cellMaps = rows.map((row) => buildCells(row, selected));
  const columns: string[] = [];
  const columnSeen = new Set<string>();
  for (const map of cellMaps) {
    for (const column of map.keys()) {
      if (!columnSeen.has(column)) {
        columnSeen.add(column);
        columns.push(column);
      }
    }
  }
  // 勾了但所有行都没有的 key 也保留为空列（勾了就该在表里）
  for (const key of selected) {
    if (!columnSeen.has(key) && !columns.some((c) => c === key || c.startsWith(`${key}.`))) {
      columns.push(key);
    }
  }

  const lines = [columns.map(esc).join(",")];
  for (const map of cellMaps) {
    lines.push(columns.map((column) => esc(map.get(column) ?? "")).join(","));
  }

  const tableRows = cellMaps.map((map) => columns.map((column) => map.get(column) ?? ""));
  return { keys, json, csv: lines.join("\r\n"), columns, rows: tableRows, rowCount: rows.length };
}

// ————— 定位路径 —————

export function resolvePath(
  root: unknown,
  pathText: string,
): { ok: true; value: unknown } | { ok: false; message: string } {
  const raw = pathText.trim();
  if (!raw) return { ok: true, value: root };

  const segs: (string | number)[] = [];
  let buf = "";
  const flush = () => {
    if (buf) {
      segs.push(buf);
      buf = "";
    }
  };
  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    if (c === ".") {
      flush();
      i++;
      if (i >= raw.length) return { ok: false, message: "路径不能以 . 结尾" };
      continue;
    }
    if (c === "[") {
      flush();
      const end = raw.indexOf("]", i);
      if (end === -1) return { ok: false, message: "路径中方括号未闭合" };
      const index = raw.slice(i + 1, end).trim();
      if (!/^\d+$/.test(index)) {
        return { ok: false, message: `[] 内应为数字下标：${raw.slice(i, end + 1)}` };
      }
      segs.push(Number(index));
      i = end + 1;
      if (i < raw.length && raw[i] !== "." && raw[i] !== "[") {
        return { ok: false, message: `"]" 之后应为 "." 或 "["：${raw.slice(i - 1, i + 2)}` };
      }
      if (raw[i] === ".") {
        i++;
        if (i >= raw.length) return { ok: false, message: "路径不能以 . 结尾" };
      }
      continue;
    }
    buf += c;
    i++;
  }
  flush();

  let cur: unknown = root;
  for (const seg of segs) {
    if (cur === null || typeof cur !== "object") {
      return { ok: false, message: `路径「${raw}」中途失效（${typeName(cur)} 无法再取下级）` };
    }
    const next = Array.isArray(cur)
      ? typeof seg === "number"
        ? cur[seg]
        : undefined
      : hasOwn(cur as object, seg as string)
        ? (cur as Record<string, unknown>)[seg as string]
        : undefined;
    if (next === undefined) {
      return { ok: false, message: `路径「${raw}」指向的值不存在` };
    }
    cur = next;
  }
  return { ok: true, value: cur };
}

// ————— CSV 单元格 —————

/** 取一列的值：优先顶层字段，否则按点路径解析（手动补充的深层列，如 addr.city、tags[0]）
 * 用 hasOwnProperty 判存在——`in` 会命中原型链，constructor/toString 等键名会假命中。 */
function valueAt(row: Record<string, unknown>, key: string): unknown {
  if (hasOwn(row, key)) return row[key];
  const located = resolvePath(row, key);
  return located.ok ? located.value : undefined;
}

/** 一行的单元格：key → 文本。对象值递归拍平为点路径列，数组/标量为叶子 */
function buildCells(row: Record<string, unknown>, selected: string[]): Map<string, string> {
  const cells = new Map<string, string>();
  const flatten = (prefix: string, value: unknown) => {
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      const entries = Object.entries(value as Record<string, unknown>);
      if (entries.length === 0) {
        cells.set(prefix, "{}");
        return;
      }
      for (const [k, v] of entries) flatten(`${prefix}.${k}`, v);
      return;
    }
    cells.set(prefix, cellText(value));
  };
  for (const key of selected) {
    const value = valueAt(row, key);
    if (value === undefined) continue;
    flatten(key, value);
  }
  return cells;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

// ————— 杂项 —————

/** 自身属性判定——避免读到原型链上的 constructor/toString 等假值 */
function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function typeName(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "数组";
  switch (typeof value) {
    case "string":
      return "字符串";
    case "number":
      return "数字";
    case "boolean":
      return "布尔";
    default:
      return typeof value;
  }
}

/** 从 JSON.parse 的报错里尽量还原行号（引擎不给位置时退回自带扫描，见 json-common/scan） */
function extractError(err: unknown, text: string, leadLines: number): ExtractError {
  const message = err instanceof Error ? err.message : String(err);

  const lineMatch = /line (\d+)/i.exec(message);
  if (lineMatch) return { message, line: leadLines + Number(lineMatch[1]) };

  const posMatch = /position (\d+)/i.exec(message);
  const offset = posMatch ? Number(posMatch[1]) : findJsonErrorOffset(text);
  if (offset === undefined) return { message };
  return { message, line: leadLines + lineAt(text, offset) };
}
