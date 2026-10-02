import { defineTool } from "../../platform/registry";
import { implLoaders } from "../loaders";
import { Regex } from "lucide-react";
import { texts } from "./texts";

export const regexTester = defineTool(
  {
    id: "regex-tester",
    name: texts.name,
    description: texts.description,
    icon: Regex,
    group: "text",
    keywords: texts.keywords,
  },
  implLoaders["regex-tester"],
);
