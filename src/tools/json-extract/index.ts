import { defineTool } from "../../platform/registry";
import { implLoaders } from "../loaders";
import { FileSpreadsheet } from "lucide-react";
import { texts } from "./texts";

export const jsonExtract = defineTool(
  {
    id: "json-extract",
    name: texts.name,
    description: texts.description,
    icon: FileSpreadsheet,
    group: "json",
    keywords: texts.keywords,
  },
  implLoaders["json-extract"],
);
