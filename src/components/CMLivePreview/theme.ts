import { EditorView } from "@codemirror/view";

export const cmTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontFamily: "var(--ui-font, HarmonyOS Sans, sans-serif)",
    backgroundColor: "transparent",
  },
  ".cm-content": {
    fontFamily: "var(--ui-font, HarmonyOS Sans, sans-serif)",
    padding: "32px calc((100% - var(--editor-content-width, 900px)) / 2)",
    fontSize: "var(--editor-font-size, 16px)",
    lineHeight: "1.7",
    caretColor: "var(--cm-cursor-color, #d8dee9)",
    color: "var(--cm-text, #d8dee9)",
  },
  ".cm-line": {
    textDecoration: "none",
    fontFamily: "var(--ui-font, HarmonyOS Sans, sans-serif)",
    padding: "0 6px",
  },
  ".cm-activeLine": { background: "var(--cm-activeLine-bg, rgba(216,222,233,0.05))", textDecoration: "none" },

  /* Heading overrides — ensure no underlines via theme */
  ".tok-heading, .tok-heading1, .tok-heading2, .tok-heading3, .tok-heading4, .tok-heading5, .tok-heading6": {
    textDecoration: "none",
    borderBottom: "none",
  },
  ".cm-md-heading-text, .cm-md-heading-1, .cm-md-heading-2, .cm-md-heading-3, .cm-md-heading-4, .cm-md-heading-5, .cm-md-heading-6": {
    textDecoration: "none",
    borderBottom: "none",
  },
  "[class*=\"tok-heading\"]": {
    textDecoration: "none",
    borderBottom: "none",
  },
  "u.tok-heading, u.tok-heading *, u[class*=\"heading\"], u[class*=\"heading\"] *": {
    textDecoration: "none",
    borderBottom: "none",
  },
  ".cm-line .tok-heading, .cm-line [class*=\"tok-heading\"]": {
    textDecoration: "none",
    borderBottom: "none",
  },
  /* Kill u-tag underline from CodeMirror heading rendering — FORCE */
  "u": {
    textDecoration: "none !important",
    borderBottom: "none !important",
  },
  "u *": {
    textDecoration: "none !important",
    borderBottom: "none !important",
  },
  "u.tok-heading, u.tok-heading *, u.tok-heading1, u.tok-heading1 *, u.tok-heading2, u.tok-heading2 *, u.tok-heading3, u.tok-heading3 *, u.tok-heading4, u.tok-heading4 *, u.tok-heading5, u.tok-heading5 *, u.tok-heading6, u.tok-heading6 *": {
    textDecoration: "none !important",
    borderBottom: "none !important",
  },
  "span.tok-heading, span.tok-heading1, span.tok-heading2, span.tok-heading3, span.tok-heading4, span.tok-heading5, span.tok-heading6": {
    textDecoration: "none !important",
    borderBottom: "none !important",
  },
  ".cm-activeLineGutter": { background: "transparent" },
  ".cm-gutters": {
    border: "none",
    background: "transparent",
    color: "var(--cm-gutter-color, #4C566A)",
    fontSize: "12px",
    paddingRight: "12px",
  },
  ".cm-gutterElement": { lineHeight: "1.5" },
  ".cm-cursor": { borderLeftColor: "var(--cm-cursor-color, #d8dee9)" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    background: "var(--cm-selection-bg, rgba(94,129,172,0.35))",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-selectionMatch": { background: "var(--cm-selectionMatch-bg, rgba(216,222,233,0.06))" },
  ".cm-searchMatch": {
    background: "var(--cm-searchMatch-bg, rgba(235,203,139,0.35))",
    color: "inherit",
  },
  ".cm-searchMatch-selected": {
    background: "var(--cm-searchMatchSel-bg, rgba(208,135,112,0.45))",
    color: "inherit",
  },
  ".cm-panel": {
    background: "var(--cm-panel-bg, #3B4252)",
    borderColor: "var(--cm-panel-border, #434C5E)",
    color: "var(--cm-panel-color, #d8dee9)",
  },
  ".cm-panel input": {
    background: "var(--cm-input-bg, #2E3440)",
    border: "1px solid var(--cm-panel-border, #434C5E)",
    borderRadius: "4px",
    color: "var(--cm-text, #d8dee9)",
    padding: "2px 8px",
  },
  ".cm-panel button": {
    background: "var(--cm-button-bg, #434C5E)",
    border: "1px solid var(--cm-panel-border, #434C5E)",
    borderRadius: "4px",
    color: "var(--cm-panel-color, #d8dee9)",
    cursor: "pointer",
    padding: "2px 10px",
  },
  ".cm-panel button:hover": { background: "var(--cm-button-hover, #4C566A)" },
  ".cm-panel button[name=close]": { background: "transparent", border: "none" },
  ".cm-button": {
    background: "var(--cm-button-bg, #434C5E)",
    border: "1px solid var(--cm-panel-border, #434C5E)",
    borderRadius: "3px",
    color: "var(--cm-panel-color, #d8dee9)",
    cursor: "pointer",
    fontSize: "12px",
    padding: "1px 8px",
  },
  ".cm-textfield": {
    background: "var(--cm-input-bg, #2E3440)",
    border: "1px solid var(--cm-panel-border, #434C5E)",
    borderRadius: "3px",
    color: "var(--cm-text, #d8dee9)",
    fontSize: "12px",
    padding: "2px 6px",
  },
});

export const darkTheme = EditorView.theme({}, { dark: true });