import { EditorView } from "@codemirror/view";

/**
 * 把光标移到第 line 行（1 起）并滚动到视野中央，再聚焦编辑器。
 *
 * 「错误行号点击跳转」的统一实现——布局模板与各异形工具的输入区共用同一套行为，
 * 避免每个工具各写一遍光标/滚动逻辑（行号越界按首/末行夹取）。
 */
export function jumpToLine(view: EditorView | null, line: number): void {
  if (!view) return;
  const doc = view.state.doc;
  const pos = doc.line(Math.max(1, Math.min(line, doc.lines))).from;
  view.dispatch({
    selection: { anchor: pos },
    effects: EditorView.scrollIntoView(pos, { y: "center" }),
  });
  view.focus();
}
