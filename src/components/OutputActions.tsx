import { useRef, useState } from "react";
import { ArrowDownToLine, Check, Copy } from "lucide-react";
import { copyText } from "../platform/clipboard";
import { saveTextFile } from "../platform/saveFile";
import type { FileFilter } from "../platform/saveFile";
import { SendToMenu } from "./SendToMenu";
import { TextActionsMenu } from "./TextActionsMenu";

/** 统一的输出工具栏动作：发送到… / 文本操作 / 另存为 / 复制。 */
export function OutputActions({
  text,
  disabled,
  fileName = "output.txt",
  saveFilters,
  showTextActions = true,
  onTextAction,
}: {
  text: string;
  disabled?: boolean;
  fileName?: string;
  saveFilters?: FileFilter[];
  showTextActions?: boolean;
  onTextAction?: (result: string, label: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flash = (setter: (v: boolean) => void) => {
    setter(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setter(false);
      setCopied(false);
    }, 1200);
  };

  return (
    <>
      <SendToMenu text={text} disabled={disabled} />
      {showTextActions && onTextAction && (
        <TextActionsMenu text={text} disabled={disabled} onApply={onTextAction} />
      )}
      <button
        className="icon-btn"
        title={saved ? "已保存" : "另存为文件"}
        disabled={disabled}
        onClick={() => {
          void saveTextFile(text, fileName, saveFilters).then((path) => {
            if (path !== null) flash(setSaved);
          });
        }}
      >
        {saved ? <Check size={13} className="text-ok" /> : <ArrowDownToLine size={13} />}
      </button>
      <button
        className="icon-btn"
        title={copied ? "已复制" : "复制输出"}
        disabled={disabled}
        onClick={() => {
          void copyText(text).then(() => flash(setCopied));
        }}
      >
        {copied ? <Check size={13} className="text-ok" /> : <Copy size={13} />}
      </button>
    </>
  );
}
