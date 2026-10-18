import { useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * 轻量弹出层：图标按钮 + 锚定在下方的小卡片。
 *
 * 用 fixed 定位而非 absolute——卡片容器普遍 overflow-hidden（输出区卡片就是），
 * absolute 会被裁掉；锚点坐标在打开瞬间由按钮 rect 算出，遮罩拦住交互故无需跟随滚动。
 * 无第三方依赖：透明全屏层负责「点外部关闭」，卡片自身吃掉冒泡。
 */
export function PopoverButton({
  icon,
  title,
  disabled,
  align = "right",
  children,
}: {
  icon: ReactNode;
  title: string;
  disabled?: boolean;
  align?: "left" | "right";
  children: (close: () => void) => ReactNode;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [anchor, setAnchor] = useState<{ top?: number; bottom?: number; left?: number; right?: number } | null>(
    null,
  );
  const close = () => setAnchor(null);

  const openAt = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const EDGE = 8;
    const ESTIMATED_HEIGHT = 320;
    const style: { top?: number; bottom?: number; left?: number; right?: number } = {};
    if (rect.bottom + ESTIMATED_HEIGHT > window.innerHeight && rect.top > ESTIMATED_HEIGHT) {
      style.bottom = window.innerHeight - rect.top + 4; // 空间不足时向上展开
    } else {
      style.top = rect.bottom + 4;
    }
    if (align === "right") style.right = Math.max(EDGE, window.innerWidth - rect.right);
    else style.left = Math.max(EDGE, rect.left);
    setAnchor(style);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="icon-btn"
        title={title}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        onClick={() => (anchor ? close() : openAt())}
      >
        {icon}
      </button>
      {anchor && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={close} />
          <div
            role="menu"
            className="card fixed z-50 max-h-80 min-w-40 overflow-y-auto rounded-xl p-1 shadow-[var(--shadow-dialog)]"
            style={anchor}
          >
            {children(close)}
          </div>
        </>
      )}
    </>
  );
}

/** 弹出层里的一个条目 */
export function PopoverItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon?: ReactNode;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-muted transition-colors hover:bg-hover hover:text-text"
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="shrink-0 text-2xs text-faint">{hint}</span>}
    </button>
  );
}
