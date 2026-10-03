import { defineTool } from "../../platform/registry";
import { implLoaders } from "../loaders";
import { GitCompare } from "lucide-react";
import { texts } from "./texts";

export const jsonDiff = defineTool(
  {
    id: "json-diff",
    name: texts.name,
    description: texts.description,
    icon: GitCompare,
    group: "json",
    keywords: texts.keywords,
  },
  implLoaders["json-diff"],
);
