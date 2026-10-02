import { defineTool } from "../../platform/registry";
import { implLoaders } from "../loaders";
import { Braces } from "lucide-react";
import { texts } from "./texts";

export const jsonFormatter = defineTool(
  {
    id: "json-formatter",
    name: texts.name,
    description: texts.description,
    icon: Braces,
    group: "format",
    keywords: texts.keywords,
  },
  implLoaders["json-formatter"],
);
