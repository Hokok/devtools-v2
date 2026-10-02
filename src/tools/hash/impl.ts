import type { ToolImpl } from "../../platform/types";
import { hash, hashDefaults, hashSchema } from "./transform";

const hashImpl: ToolImpl = {
  defaultSettings: { ...hashDefaults },
  settingsSchema: [...hashSchema],
  sample: "hello world",
  transform: hash,
};

export default hashImpl;
