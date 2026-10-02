import { useEffect, useRef } from "react";
import type { LanguageSupport } from "@codemirror/language";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
} from "@codemirror/language";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { search, searchKeymap } from "@codemirror/search";
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as cmPlaceholder,
} from "@codemirror/view";
import { useUi } from "../platform/stores/ui";
import { editorTheme } from "./cmTheme";

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
}

export function CodeEditor({
  value,
  onChange,
  readOnly,
  placeholder,
  language,
  autoFocus,
  onViewReady,
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
          EditorView.editable.of(!readOnly),
        ]),
        langComp.current.of([]),
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
        EditorView.editable.of(!readOnly),
      ]),
    });
  }, [readOnly]);

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

  return <div ref={hostRef} className="h-full min-h-0 overflow-hidden" />;
}
