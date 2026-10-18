import type { ToolImpl } from "../../platform/types";
import { JsonDiff } from "./JsonDiff";

/**
 * 异形工具（ADR-0003 逃逸）：双输入实时比对；无工具级设置项。
 * sideView：两侧内容区的视图模式（树视图/文本视图，ADR-0005）。
 * 与输出型工具不同，这里两侧都是可编辑输入区——默认文本视图（保持可编辑），
 * 切到树视图才变只读；这是「输入区保持可编辑」与「双侧独立树」两条决策的折衷。
 */
const jsonDiffImpl: ToolImpl = {
  defaultSettings: { sideView: "text" },
  Component: JsonDiff,
};

export default jsonDiffImpl;
