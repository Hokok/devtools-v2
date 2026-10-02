import { defineTool } from "../../platform/registry";
import { implLoaders } from "../loaders";
import { Binary } from "lucide-react";
import { texts } from "./texts";

export const base64Tool = defineTool(
  {
    id: "base64",
    name: texts.name,
    description: texts.description,
    icon: Binary,
    group: "encode",
    keywords: texts.keywords,
  },
  implLoaders["base64"],
);
