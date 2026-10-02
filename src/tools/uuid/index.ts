import { defineTool } from "../../platform/registry";
import { implLoaders } from "../loaders";
import { Fingerprint } from "lucide-react";
import { texts } from "./texts";

export const uuidTool = defineTool(
  {
    id: "uuid",
    name: texts.name,
    description: texts.description,
    icon: Fingerprint,
    group: "generate",
    keywords: texts.keywords,
  },
  implLoaders["uuid"],
);
