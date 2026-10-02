import type { ToolImpl } from "../../platform/types";
import { urlCodec, urlDefaults, urlSchema } from "./transform";

const urlImpl: ToolImpl = {
  defaultSettings: { ...urlDefaults },
  settingsSchema: [...urlSchema],
  sample: "https://example.com/search?q=开发者工具箱&page=2",
  transform: urlCodec,
};

export default urlImpl;
