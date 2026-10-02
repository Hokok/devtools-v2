import { defineTool } from "../../platform/registry";
import { implLoaders } from "../loaders";
import { Hash } from "lucide-react";
import { texts } from "./texts";

export const hashTool = defineTool(
  {
    id: "hash",
    name: texts.name,
    description: texts.description,
    icon: Hash,
    group: "digest",
    keywords: texts.keywords,
  },
  implLoaders["hash"],
);
