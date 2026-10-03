import type { ToolImpl } from "../platform/types";

/**
 * 工具实现体的加载映射——registry 与 transform worker 共用的单一来源。
 * 只指向 impl 模块（纯转换逻辑 + 可选组件），不经过工具 index.ts，
 * 因此 worker 包不会被 lucide/react 污染（worker 里只需要 transform）。
 * 新增工具时在这里加一行，并在对应 index.ts 里引用同一 loader。
 */
export const implLoaders: Record<string, () => Promise<ToolImpl>> = {
  "json-formatter": () => import("./json-formatter/impl").then((m) => m.default),
  "json-diff": () => import("./json-diff/impl").then((m) => m.default),
  "json-extract": () => import("./json-extract/impl").then((m) => m.default),
  base64: () => import("./base64/impl").then((m) => m.default),
  "url-codec": () => import("./url-codec/impl").then((m) => m.default),
  timestamp: () => import("./timestamp/impl").then((m) => m.default),
  uuid: () => import("./uuid/impl").then((m) => m.default),
  hash: () => import("./hash/impl").then((m) => m.default),
  "jwt-decoder": () => import("./jwt-decoder/impl").then((m) => m.default),
  "regex-tester": () => import("./regex-tester/impl").then((m) => m.default),
};
