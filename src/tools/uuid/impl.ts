import type { ToolImpl } from "../../platform/types";
import { generateUuids, uuidDefaults, uuidSchema } from "./transform";

const uuidImpl: ToolImpl = {
  defaultSettings: { ...uuidDefaults },
  settingsSchema: [...uuidSchema],
  inputPlaceholder: "生成器无需输入——数量与格式在右侧设置",
  transform: generateUuids,
};

export default uuidImpl;
