import type { ReactNode } from "react";
import { Pin, Copy, CornerDownLeft, Trash2, X } from "lucide-react";
import { fmtAgo } from "../platform/format";
import { copyText } from "../platform/clipboard";
import { useClipboardHistory } from "../platform/stores/clipboardHistory";
import { useHistory } from "../platform/stores/history";
import type { HistoryEntry } from "../platform/stores/history";
import { useTabs } from "../platform/stores/tabs";
import { useUi } from "../platform/stores/ui";
import { getTool } from "../platform/registry";

/**
 * 底部工具弹窗（一次只开一个）：
 * - 会话历史（见 CONTEXT.md）：当前激活工具最近输入的留档，可回填 / pin / 删除；
 * - 剪贴板历史（见 CONTEXT.md）：应用内复制过的文本，可再复制 / 填回输入。
 * 两者都是会话态，重启即清。
 */
export function UtilityDialogs() {
  const dialog = useUi((s) => s.utilityDialog);
  if (!dialog) return null;
  return dialog === "history" ? <SessionHistoryDialog /> : <ClipboardHistoryDialog />;
}

function SessionHistoryDialog() {
  const close = () => useUi.getState().setUtilityDialog(null);
  const activeId = useTabs((s) => s.activeId);
  const activeToolId = useTabs((s) => s.tabs.find((t) => t.id === s.activeId)?.toolId ?? null);
  const entries = useHistory((s) => (activeToolId ? s.byTool[activeToolId] : undefined)) ?? EMPTY;

  const fill = (entry: HistoryEntry) => {
    if (activeId) useTabs.getState().setInput(activeId, entry.text);
    close();
  };

  return (
    <Modal title="会话历史" subtitle={activeToolId ? getTool(activeToolId)?.meta.name : undefined} onClose={close}>
      {!activeToolId ? (
        <p className="px-3 py-8 text-center text-xs text-faint">先打开一个工具，这里显示它的输入留档。</p>
      ) : entries.length === 0 ? (
        <p className="px-3 py-8 text-center text-xs text-faint">
          还没有留档。清空输入、载入文件或关闭标签页时，原内容会自动留在这里。
        </p>
      ) : (
        <div>
          <div className="flex justify-end px-1 pb-1">
            <button
              className="pressable text-2xs text-muted hover:text-danger"
              onClick={() => activeToolId && useHistory.getState().clear(activeToolId)}
            >
              清空历史
            </button>
          </div>
          {entries.map((entry) => (
            <Row
              key={entry.id}
              text={entry.text}
              meta={fmtAgo(entry.at)}
              pinned={entry.pinned}
              onFill={() => fill(entry)}
              onPin={() => activeToolId && useHistory.getState().togglePin(activeToolId, entry.id)}
              onRemove={() => activeToolId && useHistory.getState().remove(activeToolId, entry.id)}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

function ClipboardHistoryDialog() {
  const close = () => useUi.getState().setUtilityDialog(null);
  const items = useClipboardHistory((s) => s.items);
  const activeId = useTabs((s) => s.activeId);

  const fill = (text: string) => {
    if (activeId) useTabs.getState().setInput(activeId, text);
    else useTabs.getState().loadTextIntoActive(text);
    close();
  };

  return (
    <Modal title="剪贴板历史" subtitle="仅记录应用内复制过的内容" onClose={close}>
      {items.length === 0 ? (
        <p className="px-3 py-8 text-center text-xs text-faint">
          还没有记录。在应用内复制输出后，内容会出现在这里。
        </p>
      ) : (
        <div>
          <div className="flex justify-end px-1 pb-1">
            <button
              className="pressable text-2xs text-muted hover:text-danger"
              onClick={() => useClipboardHistory.getState().clear()}
            >
              清空记录
            </button>
          </div>
          {items.map((item) => (
            <Row
              key={item.id}
              text={item.text}
              meta={fmtAgo(item.at)}
              onFill={() => fill(item.text)}
              onCopy={() => void copyText(item.text)}
              onRemove={() => useClipboardHistory.getState().remove(item.id)}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

const EMPTY: HistoryEntry[] = [];

function Row({
  text,
  meta,
  pinned,
  onFill,
  onPin,
  onCopy,
  onRemove,
}: {
  text: string;
  meta: string;
  pinned?: boolean;
  onFill: () => void;
  onPin?: () => void;
  onCopy?: () => void;
  onRemove: () => void;
}) {
  const firstLine = text.split("\n", 1)[0] ?? "";
  return (
    <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-hover">
      <button className="min-w-0 flex-1 text-left" title="填入当前输入" onClick={onFill}>
        <span className="block truncate font-mono text-xs text-text">{firstLine || "（空行开始）"}</span>
        <span className="block text-2xs text-faint">
          {meta}
          {text.includes("\n") ? " · 多行" : ""}
        </span>
      </button>
      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        {onCopy && (
          <button className="icon-btn" title="复制" onClick={onCopy}>
            <Copy size={12} />
          </button>
        )}
        {onPin && (
          <button
            className={`icon-btn ${pinned ? "text-accent opacity-100" : ""}`}
            title={pinned ? "取消置顶" : "置顶（不参与容量淘汰）"}
            onClick={onPin}
          >
            <Pin size={12} />
          </button>
        )}
        <button className="icon-btn hover:text-danger" title="删除" onClick={onRemove}>
          <Trash2 size={12} />
        </button>
      </span>
      <CornerDownLeft size={11} className="shrink-0 text-faint opacity-0 group-hover:opacity-60" />
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[var(--overlay)] pt-[14vh] backdrop-blur-[3px]"
      onMouseDown={onClose}
      onKeyDown={(e) => {
        if (e.nativeEvent.isComposing || e.keyCode === 229) return;
        if (e.key === "Escape") {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-label={title}
        className="card flex max-h-[70vh] w-[520px] max-w-[90vw] flex-col overflow-hidden rounded-2xl shadow-[var(--shadow-dialog)]"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ animation: "palette-pop 120ms ease-out" }}
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-line/60 px-4 py-2.5">
          <h2 className="text-sm font-semibold text-text">{title}</h2>
          {subtitle && <span className="truncate text-xs text-faint">{subtitle}</span>}
          <button className="icon-btn ml-auto" title="关闭" onClick={onClose}>
            <X size={14} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">{children}</div>
      </div>
      <style>{`@keyframes palette-pop { from { opacity: 0; transform: translateY(-4px) scale(0.985); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  );
}
