import type { ToolImpl } from "../../platform/types";
import { decodeJwt, jwtDefaults, jwtSchema } from "./transform";

const sample =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IumprOmaj+i/veWoiyIsInJvbGUiOiJhZG1pbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxOTAwMDAwMDAwfQ.7TdL8E5xuWyZpUq8NlxJqCGc8sQ9T0c1tE8wJ9O8Zm4";

const jwtImpl: ToolImpl = {
  defaultSettings: { ...jwtDefaults },
  settingsSchema: [...jwtSchema],
  sample,
  transform: decodeJwt,
};

export default jwtImpl;
