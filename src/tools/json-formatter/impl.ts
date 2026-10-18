import type { ToolImpl } from "../../platform/types";
import { formatJson, jsonDefaults, jsonSchema } from "./transform";

const sample = `{
  "name": "DevTools",
  "version": "0.1.0",
  "工具箱": true,
  "items": [1, 2, 3],
  "nested": { "ok": true, "pi": 3.14159, "tags": ["dev", "工具"] }
}`;

const jsonImpl: ToolImpl = {
  defaultSettings: { ...jsonDefaults },
  settingsSchema: [...jsonSchema],
  sample,
  transform: formatJson,
  language: () => import("@codemirror/lang-json").then((m) => m.json()),
};

export default jsonImpl;
