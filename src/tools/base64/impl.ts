import type { ToolImpl } from "../../platform/types";
import { base64Codec, base64Defaults, base64Schema } from "./transform";

const base64Impl: ToolImpl = {
  defaultSettings: { ...base64Defaults },
  settingsSchema: [...base64Schema],
  sample: "开发者工具箱 DevTools ✓",
  transform: base64Codec,
};

export default base64Impl;
