import type { ToolImpl } from "../../platform/types";
import { JsonExtract } from "./JsonExtract";

/**
 * 异形工具（ADR-0003 逃逸）：定位路径与勾选列是自定义交互，标准设置面板的
 * 五种字段表达不了。两项都存工具级设置（path / cols），同工具跨 Tab、跨重启共享。
 */
const jsonExtractImpl: ToolImpl = {
  defaultSettings: { path: "", cols: "[]", valueArray: false },
  sample: `{"code":0,"data":{"list":[{"id":1,"name":"张三","age":29,"tags":["vip"],"addr":{"city":"上海","zip":"200000"}},{"id":2,"name":"李四","age":31,"tags":[],"addr":{"city":"北京","zip":"100000"}}]}}`,
  Component: JsonExtract,
};

export default jsonExtractImpl;
