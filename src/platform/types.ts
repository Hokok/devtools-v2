import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";

/** 工具分组。左侧导航与命令面板都按此组织。 */
export type ToolGroupId = "format" | "encode" | "convert" | "generate" | "digest" | "text";

export interface ToolGroup {
  id: ToolGroupId;
  name: string;
}

export const TOOL_GROUPS: ToolGroup[] = [
  { id: "format", name: "格式化" },
  { id: "encode", name: "编解码" },
  { id: "convert", name: "转换" },
  { id: "generate", name: "生成器" },
  { id: "digest", name: "哈希校验" },
  { id: "text", name: "文本处理" },
];

export interface TransformError {
  message: string;
  line?: number;
}

export interface TransformResult {
  output?: string;
  error?: TransformError;
}

export type ToolSettings = Record<string, string | number | boolean>;

/**
 * 设置面板的声明式 schema。刻意只支持五种字段类型：
 * 设置面板的可预测性比表达力重要（见 docs/DESIGN.md §4.1）。
 */
export type SettingField =
  | {
      type: "toggle";
      key: string;
      label: string;
      hint?: string;
      default: boolean;
      visibleWhen?: SettingCondition;
    }
  | {
      type: "select";
      key: string;
      label: string;
      default: string;
      options: { value: string; label: string }[];
      hint?: string;
      visibleWhen?: SettingCondition;
    }
  | {
      type: "number";
      key: string;
      label: string;
      default: number;
      min?: number;
      max?: number;
      step?: number;
      hint?: string;
      visibleWhen?: SettingCondition;
    }
  | {
      type: "text";
      key: string;
      label: string;
      default: string;
      placeholder?: string;
      hint?: string;
      visibleWhen?: SettingCondition;
    }
  | { type: "divider"; key: string; label?: string };

export interface SettingCondition {
  key: string;
  equals: string | number | boolean;
}

/** 异形工具的自定义布局组件（整体覆盖布局模板，见 ADR-0003）。 */
export interface ToolComponentProps {
  input: string;
  onInput: (value: string) => void;
  settings: ToolSettings;
  onSettingsChange: (patch: ToolSettings) => void;
  /** 与模板工具一致的示例数据（供「载入示例」按钮） */
  sample?: string;
}

export type ToolComponent = ComponentType<ToolComponentProps>;

/**
 * 工具实现体（懒加载部分）。模板型工具只需 transform；
 * 异形工具提供 Component 并整体覆盖布局。
 */
export interface ToolImpl {
  defaultSettings: ToolSettings;
  settingsSchema?: SettingField[];
  sample?: string;
  /** 输入区占位文案（如生成器类工具提示"无需输入"） */
  inputPlaceholder?: string;
  /** 空输入时每秒重跑 transform（时间戳工具的"实时当前时刻"） */
  live?: boolean;
  /** 编辑器语言包，按需加载（如 JSON 高亮），跟随工具实现进分包 */
  language?: () => Promise<import("@codemirror/language").LanguageSupport>;
  transform?: (input: string, settings: ToolSettings) => TransformResult | Promise<TransformResult>;
  Component?: ToolComponent;
}

/** 注册表元信息——静态可见，应用启动即加载，不含任何实现。 */
export interface ToolMeta {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  group: ToolGroupId;
  /** 命令面板补充搜索词 */
  keywords?: string[];
}

export interface RegisteredTool {
  meta: ToolMeta;
  load: () => Promise<LoadedTool>;
}

export interface LoadedTool extends ToolMeta, ToolImpl {}
