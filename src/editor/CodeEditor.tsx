import { useEffect, useRef } from "react";
import type { LanguageSupport } from "@codemirror/language";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
} from "@codemirror/language";
import { Compartment, EditorState, StateEffect, StateField, Transaction } from "@codemirror/state";
import type { Range } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import {
  Decoration,
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as cmPlaceholder,
} from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import { useUi } from "../platform/stores/ui";
import { editorTheme } from "./cmTheme";

/** 原位标记（如 JSON 比对的高亮）：offset 对应灌入时的文档，编辑后由编辑器自动映射 */
export interface EditorMark {
  from: number;
  to: number;
  className: string;
}

const setMarksEffect = StateEffect.define<readonly EditorMark[]>();

const marksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(marks, tr) {
    marks = marks.map(tr.changes);
    for (const effect of tr.effects) {
      if (!effect.is(setMarksEffect)) continue;
      const ranges: Range<Decoration>[] = [];
      for (const mark of effect.value) {
        const from = Math.max(0, Math.min(mark.from, tr.state.doc.length));
        const to = Math.max(0, Math.min(mark.to, tr.state.doc.length));
        if (to > from) ranges.push(Decoration.mark({ class: mark.className }).range(from, to));
      }
      marks = ranges.length ? Decoration.set(ranges, true) : Decoration.none;
    }
    return marks;
  },
  provide: (field) => EditorView.decorations.from(field),
});

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  /** 语言包按需加载（由各工具的 impl 提供，编辑器本身零语言依赖） */
  language?: () => Promise<LanguageSupport>;
  autoFocus?: boolean;
  /** 视图实例就绪后回调（供折叠全部/展开全部等命令使用；销毁时回调 null） */
  onViewReady?: (view: EditorView | null) => void;
  /** 原位标记（差异高亮等），整批替换 */
  marks?: EditorMark[];
}

export function CodeEditor({
  value,
  onChange,
  readOnly,
  placeholder,
  language,
  autoFocus,
  onViewReady,
  marks,
}: CodeEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const langComp = useRef(new Compartment());
  const readOnlyComp = useRef(new Compartment());
  const themeComp = useRef(new Compartment());
  const onViewReadyRef = useRef(onViewReady);
  onViewReadyRef.current = onViewReady;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const dark = useUi.getState().theme === "dark";
    const state = EditorState.create({
      doc: value,
      extensions: [
        // 主题进 compartment：亮/暗切换即时重配置，无需重建编辑器
        themeComp.current.of(editorTheme(dark)),
        lineNumbers(),
        foldGutter(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        search(),
        indentOnInput(),
        bracketMatching(),
        EditorView.lineWrapping,
        readOnlyComp.current.of([
          EditorState.readOnly.of(readOnly ?? false),
          // 只锁编辑不锁交互：输出面板保持可聚焦/可选中，⌘F 搜索、折叠、⌘C 复制选中都照常可用
          // （editable:false 会让点击不聚焦、键盘事件进不来，搜索永远打不开）
          EditorView.editable.of(true),
        ]),
        langComp.current.of([]),
        marksField,
        cmPlaceholder(placeholder ?? ""),
        keymap.of([...(readOnly ? [] : [indentWithTab]), ...defaultKeymap, ...historyKeymap, ...searchKeymap, ...foldKeymap]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && onChangeRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    if (autoFocus) view.focus();
    viewRef.current = view;
    onViewReadyRef.current?.(view);
    return () => {
      onViewReadyRef.current?.(null);
      view.destroy();
      viewRef.current = null;
    };
    // 编辑器实例只创建一次；value/placeholder 通过下方 effect 同步
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 主题跟随工作台（亮/暗切换即时生效，不重建编辑器）
  const theme = useUi((s) => s.theme);
  useEffect(() => {
    viewRef.current?.dispatch({
      effects: themeComp.current.reconfigure(editorTheme(theme === "dark")),
    });
  }, [theme]);

  // 外部值变化（切 Tab / 粘贴 / 示例）同步进编辑器。
  // addToHistory(false)：外部灌值不进撤销栈，防止 Cmd+Z 跨 Tab 回退到别的文档。
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
        // 外部灌入后光标回位，避免悬在超出的偏移上
        selection: { anchor: Math.min(view.state.selection.main.anchor, value.length) },
        annotations: Transaction.addToHistory.of(false),
      });
    }
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: readOnlyComp.current.reconfigure([
        EditorState.readOnly.of(readOnly ?? false),
        EditorView.editable.of(true),
      ]),
    });
  }, [readOnly]);

  useEffect(() => {
    viewRef.current?.dispatch({ effects: setMarksEffect.of(marks ?? []) });
  }, [marks]);

  useEffect(() => {
    let alive = true;
    if (!language) {
      viewRef.current?.dispatch({ effects: langComp.current.reconfigure([]) });
      return;
    }
    void language().then((support) => {
      if (alive && viewRef.current) {
        viewRef.current.dispatch({ effects: langComp.current.reconfigure([support]) });
      }
    });
    return () => {
      alive = false;
    };
  }, [language]);

  return <div ref={hostRef} className={`h-full min-h-0 overflow-hidden ${readOnly ? "read-only" : ""}`} />;
}
