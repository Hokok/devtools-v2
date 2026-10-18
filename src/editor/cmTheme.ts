import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";

/**
 * 编辑器主题：GitHub Primer 基调；JSON 值类型按可读性拉开色相（ADR-0005）。
 * dark: key #79c0fd / string #7ee787 / number #d2a8ff / bool+null #ff7b72
 * light: key #0451a5 / string #a31515 / number #098658 / bool+null #0969da
 */

const darkView = EditorView.theme(
  {
    "&": { color: "#e6edf3", backgroundColor: "transparent", height: "100%", fontSize: "13px" },
    ".cm-scroller": { fontFamily: "var(--font-code)", lineHeight: "1.5", padding: "3px 0 4px" },
    ".cm-content": { caretColor: "#4493f8" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#4493f8", borderLeftWidth: "2px" },
    "&.cm-focused": { outline: "none" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgba(56, 139, 253, 0.35) !important",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "#6e7681",
      border: "none",
      paddingRight: "4px",
      paddingLeft: "6px",
    },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#8d96a0" },
    ".cm-activeLine": { backgroundColor: "rgba(110, 118, 129, 0.08)" },
    ".cm-selectionMatch": { backgroundColor: "rgba(56, 139, 253, 0.2)" },
    ".cm-searchMatch": { backgroundColor: "rgba(210, 153, 34, 0.32)" },
    ".cm-searchMatch-selected": { backgroundColor: "rgba(210, 153, 34, 0.55)" },
    ".cm-panels": { backgroundColor: "#161b22", color: "#e6edf3", borderTop: "1px solid #30363d" },
    ".cm-panel.cm-search input, .cm-panel.cm-search button": {
      background: "#21262d",
      color: "#e6edf3",
      border: "1px solid #30363d",
      borderRadius: "6px",
      padding: "2px 6px",
      fontSize: "12px",
      fontFamily: "var(--font-code)",
    },
    ".cm-tooltip": { backgroundColor: "#161b22", border: "1px solid #30363d", borderRadius: "6px" },
    // 折叠槽：整列加宽为可点条（折叠按整行槽位响应），字形 14px + 手型光标
    ".cm-foldGutter .cm-gutterElement": {
      minWidth: "20px",
      paddingLeft: "2px",
      paddingRight: "4px",
      cursor: "pointer",
    },
    ".cm-foldGutter span": { color: "#6e7681", fontSize: "16px" },
    ".cm-foldGutter span:hover": { color: "#4493f8" },
  },
  { dark: true },
);

const darkHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.keyword, color: "#ff7b72" },
    // JSON 可读性升级（ADR-0005）：类型间拉开色相——key 蓝 / 字符串绿 / 数字紫 / 布尔红
    { tag: t.string, color: "#7ee787" },
    { tag: t.number, color: "#d2a8ff" },
    { tag: t.bool, color: "#ff7b72" },
    { tag: t.null, color: "#ff7b72", fontStyle: "italic" },
    { tag: t.comment, color: "#8b949e", fontStyle: "italic" },
    { tag: t.propertyName, color: "#79c0fd" },
    { tag: t.variableName, color: "#e6edf3" },
    { tag: t.function(t.variableName), color: "#d2a8ff" },
    { tag: t.operator, color: "#ff7b72" },
    { tag: t.punctuation, color: "#8b949e" },
    { tag: t.regexp, color: "#7ee787" },
    { tag: t.escape, color: "#ffa657" },
    { tag: t.invalid, color: "#f85149" },
  ]),
);

const lightView = EditorView.theme(
  {
    "&": { color: "#1f2328", backgroundColor: "transparent", height: "100%", fontSize: "13px" },
    ".cm-scroller": { fontFamily: "var(--font-code)", lineHeight: "1.5", padding: "3px 0 4px" },
    ".cm-content": { caretColor: "#0969da" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#0969da", borderLeftWidth: "2px" },
    "&.cm-focused": { outline: "none" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "rgba(9, 105, 218, 0.22) !important",
    },
    ".cm-gutters": {
      backgroundColor: "transparent",
      color: "#818b98",
      border: "none",
      paddingRight: "4px",
      paddingLeft: "6px",
    },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "#59636e" },
    ".cm-activeLine": { backgroundColor: "rgba(135, 131, 120, 0.08)" },
    ".cm-selectionMatch": { backgroundColor: "rgba(9, 105, 218, 0.15)" },
    ".cm-searchMatch": { backgroundColor: "rgba(154, 103, 0, 0.25)" },
    ".cm-searchMatch-selected": { backgroundColor: "rgba(154, 103, 0, 0.45)" },
    ".cm-panels": { backgroundColor: "#ffffff", color: "#1f2328", borderTop: "1px solid #d1d9de" },
    ".cm-panel.cm-search input, .cm-panel.cm-search button": {
      background: "#f6f8fa",
      color: "#1f2328",
      border: "1px solid #d1d9de",
      borderRadius: "6px",
      padding: "2px 6px",
      fontSize: "12px",
      fontFamily: "var(--font-code)",
    },
    ".cm-tooltip": { backgroundColor: "#ffffff", border: "1px solid #d1d9de", borderRadius: "6px" },
    // 折叠槽：整列加宽为可点条（折叠按整行槽位响应），字形 14px + 手型光标
    ".cm-foldGutter .cm-gutterElement": {
      minWidth: "20px",
      paddingLeft: "2px",
      paddingRight: "4px",
      cursor: "pointer",
    },
    ".cm-foldGutter span": { color: "#818b98", fontSize: "16px" },
    ".cm-foldGutter span:hover": { color: "#0969da" },
  },
  { dark: false },
);

const lightHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.keyword, color: "#cf222e" },
    // JSON 可读性升级（ADR-0005）：key 蓝 / 字符串绛红 / 数字绿 / 布尔亮蓝
    { tag: t.string, color: "#a31515" },
    { tag: t.number, color: "#098658" },
    { tag: t.bool, color: "#0969da" },
    { tag: t.null, color: "#0969da", fontStyle: "italic" },
    { tag: t.comment, color: "#6e7781", fontStyle: "italic" },
    { tag: t.propertyName, color: "#0451a5" },
    { tag: t.variableName, color: "#1f2328" },
    { tag: t.function(t.variableName), color: "#8250df" },
    { tag: t.operator, color: "#cf222e" },
    { tag: t.punctuation, color: "#57606a" },
    { tag: t.regexp, color: "#116329" },
    { tag: t.escape, color: "#953800" },
    { tag: t.invalid, color: "#82071e" },
  ]),
);

export function editorTheme(dark: boolean) {
  return dark ? [darkView, darkHighlight] : [lightView, lightHighlight];
}
