import { Send } from "lucide-react";
import { registry } from "../platform/registry";
import { useTabs } from "../platform/stores/tabs";
import { PopoverButton, PopoverItem } from "./Popover";

/**
 * 「发送到…」（见 CONTEXT.md：发送）——单向传递：把当前输出作为目标工具
 * 新标签页的输入。不做实时联动 / 管道（ADR-0004）。
 */
export function SendToMenu({ text, disabled }: { text: string; disabled?: boolean }) {
  const openTool = useTabs((s) => s.openTool);

  return (
    <PopoverButton icon={<Send size={13} />} title="发送到另一个工具" disabled={disabled}>
      {(close) =>
        registry.map((tool) => {
          const Icon = tool.meta.icon;
          return (
            <PopoverItem
              key={tool.meta.id}
              icon={<Icon size={13} className="shrink-0 text-faint" />}
              label={tool.meta.name}
              onClick={() => {
                openTool(tool.meta.id, text);
                close();
              }}
            />
          );
        })
      }
    </PopoverButton>
  );
}
