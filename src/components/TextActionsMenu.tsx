import { WandSparkles } from "lucide-react";
import { TEXT_ACTIONS } from "../platform/textActions";
import { PopoverButton, PopoverItem } from "./Popover";

/**
 * 通用文本操作（见 CONTEXT.md）：对输出文本做排序行 / 去重 / trim / 大小写 / 行号。
 * 结果回填给输出区（父组件以「覆盖显示」呈现），不改工具本身的 transform。
 */
export function TextActionsMenu({
  text,
  disabled,
  onApply,
}: {
  text: string;
  disabled?: boolean;
  onApply: (result: string, label: string) => void;
}) {
  return (
    <PopoverButton icon={<WandSparkles size={13} />} title="文本操作" disabled={disabled}>
      {(close) =>
        TEXT_ACTIONS.map((action) => (
          <PopoverItem
            key={action.id}
            label={action.label}
            onClick={() => {
              onApply(action.apply(text), action.label);
              close();
            }}
          />
        ))
      }
    </PopoverButton>
  );
}
