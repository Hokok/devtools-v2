/**
 * 位置感知的 JSON 语法扫描（JSON 系列工具共用）。
 *
 * 存在的理由：`JSON.parse` 的报错口径在引擎间不一致——SpiderMonkey 给 `line N`、
 * 旧版 V8 给 `at position N`，而**新版 V8（含 Windows WebView2）与 JavaScriptCore
 * （macOS WKWebView）都不给位置**，只丢一句 `Unexpected token ',', ...`。于是
 * "错误行号"在真实平台上经常拿不到，靠报错文案反推行号又随引擎版本漂移。
 *
 * 这里自带解析：报错行号与引擎无关，且每个节点携带原文偏移（供编辑器原位高亮）。
 * 合法性判定的唯一真相仍是各工具自己的 `JSON.parse`；本模块只解析语法、产出 span。
 */

export type SpanNode =
  | {
      kind: "object";
      start: number;
      end: number;
      props: { key: string; keyStart: number; keyEnd: number; value: SpanNode }[];
    }
  | { kind: "array"; start: number; end: number; items: SpanNode[] }
  | { kind: "scalar"; start: number; end: number; value: unknown };

export class ScanError extends Error {
  constructor(
    message: string,
    readonly offset: number,
  ) {
    super(message);
  }
}

const NUM_RE = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y;

export function parseSpans(text: string): SpanNode {
  const len = text.length;
  let pos = 0;

  const peek = () => (pos < len ? text[pos] : "");
  const ws = () => {
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 32 || c === 9 || c === 10 || c === 13) pos++;
      else break;
    }
  };
  const fail = (message: string): never => {
    throw new ScanError(message, pos);
  };

  function parseValue(): SpanNode {
    ws();
    const c = peek();
    if (c === "{") return parseObject();
    if (c === "[") return parseArray();
    const start = pos;
    if (c === '"') {
      const value = parseString();
      return { kind: "scalar", start, end: pos, value };
    }
    if (text.startsWith("true", pos)) {
      pos += 4;
      return { kind: "scalar", start, end: pos, value: true };
    }
    if (text.startsWith("false", pos)) {
      pos += 5;
      return { kind: "scalar", start, end: pos, value: false };
    }
    if (text.startsWith("null", pos)) {
      pos += 4;
      return { kind: "scalar", start, end: pos, value: null };
    }
    NUM_RE.lastIndex = pos;
    const m = NUM_RE.exec(text);
    if (m && m[0]) {
      pos = NUM_RE.lastIndex;
      return { kind: "scalar", start, end: pos, value: Number(m[0]) };
    }
    return fail("应为值");
  }

  function parseObject(): SpanNode {
    const start = pos++;
    const props: { key: string; keyStart: number; keyEnd: number; value: SpanNode }[] = [];
    ws();
    if (peek() === "}") {
      pos++;
      return { kind: "object", start, end: pos, props };
    }
    for (;;) {
      ws();
      if (peek() !== '"') fail('应为 "key": value');
      const keyStart = pos;
      const key = parseString();
      const keyEnd = pos;
      ws();
      if (peek() !== ":") fail('应为 ":"');
      pos++;
      const value = parseValue();
      props.push({ key, keyStart, keyEnd, value });
      ws();
      const c = peek();
      if (c === ",") {
        pos++;
        continue;
      }
      if (c === "}") {
        pos++;
        return { kind: "object", start, end: pos, props };
      }
      fail('应为 "," 或 "}"');
    }
  }

  function parseArray(): SpanNode {
    const start = pos++;
    const items: SpanNode[] = [];
    ws();
    if (peek() === "]") {
      pos++;
      return { kind: "array", start, end: pos, items };
    }
    for (;;) {
      items.push(parseValue());
      ws();
      const c = peek();
      if (c === ",") {
        pos++;
        continue;
      }
      if (c === "]") {
        pos++;
        return { kind: "array", start, end: pos, items };
      }
      fail('应为 "," 或 "]"');
    }
  }

  function parseString(): string {
    const start = pos++;
    while (pos < len) {
      const c = text[pos];
      if (c === '"') {
        pos++;
        return JSON.parse(text.slice(start, pos)) as string;
      }
      pos += c === "\\" ? 2 : 1;
    }
    return fail("字符串未闭合");
  }

  const node = parseValue();
  ws();
  if (pos !== len) fail("值之后存在多余内容");
  return node;
}

/** 偏移落在第几行（1 起）。 */
export function lineAt(text: string, offset: number): number {
  return text.slice(0, Math.min(offset, text.length)).split("\n").length;
}

/**
 * 文本里第一个 JSON 语法错误的偏移；文本合法或无法定位时返回 undefined。
 *
 * 只用于**已经判定为非法**的输入（调用方通常刚拿到 JSON.parse 的报错）：
 * 非法输入在扫描到出错点即抛错，不会白建整棵 span 树。
 */
export function findJsonErrorOffset(text: string): number | undefined {
  try {
    parseSpans(text);
    return undefined;
  } catch (err) {
    // 扫描器比 JSON.parse 宽松之处（如非法字符串转义）会让内层 JSON.parse 抛普通
    // 语法错误——那类错误没有可用偏移，返回 undefined 而不是瞎报一行。
    return err instanceof ScanError ? err.offset : undefined;
  }
}
