import type { ToolImpl } from "../../platform/types";
import { timestampConvert, timestampDefaults, timestampSchema } from "./transform";

const timestampImpl: ToolImpl = {
  defaultSettings: { ...timestampDefaults },
  settingsSchema: [...timestampSchema],
  sample: "1791000000",
  live: true, // 空输入时实时显示当前时刻
  transform: timestampConvert,
};

export default timestampImpl;
