import { defineTool } from "../../platform/registry";
import { implLoaders } from "../loaders";
import { KeyRound } from "lucide-react";
import { texts } from "./texts";

export const jwtDecoder = defineTool(
  {
    id: "jwt-decoder",
    name: texts.name,
    description: texts.description,
    icon: KeyRound,
    group: "encode",
    keywords: texts.keywords,
  },
  implLoaders["jwt-decoder"],
);
