import type { ToolImpl } from "../../platform/types";
import { RegexTester } from "./RegexTester";

const regexImpl: ToolImpl = {
  defaultSettings: {
    pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}",
    flags: "g",
  },
  sample: "联系 alice@example.com 或 bob.smith@dev.io，无效地址: foo@bar",
  Component: RegexTester,
};

export default regexImpl;
