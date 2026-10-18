import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * 右键菜单：在指针落点弹出的小卡片。
 *
 * 与 PopoverButton 的分工——那个锚在图标按钮下方（左键点开），这个锚在右键位置。
 * 定位同样用 fixed：卡片容器普遍 overflow-hidden，absolute 会被裁掉（见 Popover.tsx）。
 *
 * 关闭不用全屏遮罩，改成捕获阶段监听 document：这样在别处再右键时，这一层先收起、
 * 那一次右键仍照常开出新菜单；换遮罩会把事件吃掉，右键换目标就得点两次。
 */
export function ContextMenu({
  x,
  y,
  onClose,
  children,
}: {
  x: number;
  y: number;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // 菜单尺寸要渲染出来才知道，故先量后定位；量好之前不可见，免得在错位置闪一下
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const EDGE = 8;
    setPos({
      left: Math.max(EDGE, Math.min(x, window.innerWidth - width - EDGE)),
      top: Math.max(EDGE, Math.min(y, window.innerHeight - height - EDGE)),
    });
  }, [x, y]);

  useEffect(() => {
    const outside = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", outside, true);
    document.addEventListener("contextmenu", outside, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", outside, true);
      document.removeEventListener("contextmenu", outside, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      className="card fixed z-50 min-w-40 rounded-xl p-1 shadow-[var(--shadow-dialog)]"
      style={pos ? { left: pos.left, top: pos.top } : { left: x, top: y, visibility: "hidden" }}
    >
      {children}
    </div>
  );
}
