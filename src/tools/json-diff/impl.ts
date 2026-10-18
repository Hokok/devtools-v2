import type { ToolImpl } from "../../platform/types";
import { JsonDiff } from "./JsonDiff";

/** 异形工具（ADR-0003 逃逸）：双输入实时比对；无工具级设置项 */
const jsonDiffImpl: ToolImpl = {
  defaultSettings: {},
  Component: JsonDiff,
};

export default jsonDiffImpl;
