import { defineTool } from "../../platform/registry";
import { implLoaders } from "../loaders";
import { Clock3 } from "lucide-react";
import { texts } from "./texts";

export const timestampTool = defineTool(
  {
    id: "timestamp",
    name: texts.name,
    description: texts.description,
    icon: Clock3,
    group: "convert",
    keywords: texts.keywords,
  },
  implLoaders["timestamp"],
);
