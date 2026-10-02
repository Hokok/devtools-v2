import { defineTool } from "../../platform/registry";
import { implLoaders } from "../loaders";
import { Link2 } from "lucide-react";
import { texts } from "./texts";

export const urlCodec = defineTool(
  {
    id: "url-codec",
    name: texts.name,
    description: texts.description,
    icon: Link2,
    group: "encode",
    keywords: texts.keywords,
  },
  implLoaders["url-codec"],
);
