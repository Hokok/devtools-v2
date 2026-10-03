import { registerAll } from "../platform/registry";
import { jsonFormatter } from "./json-formatter";
import { jsonDiff } from "./json-diff";
import { jsonExtract } from "./json-extract";
import { base64Tool } from "./base64";
import { urlCodec } from "./url-codec";
import { timestampTool } from "./timestamp";
import { uuidTool } from "./uuid";
import { hashTool } from "./hash";
import { jwtDecoder } from "./jwt-decoder";
import { regexTester } from "./regex-tester";

// 全部经各工具 index.ts 的 defineTool 登记——只有元信息被静态引入，
// 实现体走各自的动态 import（ADR-0002）。
registerAll([
  jsonFormatter,
  jsonDiff,
  jsonExtract,
  base64Tool,
  urlCodec,
  timestampTool,
  uuidTool,
  hashTool,
  jwtDecoder,
  regexTester,
]);

// 统一出口：应用入口 `import "./tools"` 完成注册；Worker 用同一入口获得自己的注册表实例
export { registry, getTool, defineTool } from "../platform/registry";
