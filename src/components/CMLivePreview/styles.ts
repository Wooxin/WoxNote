import { HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

export const STYLE_ID = "cm-md-live-style";

// Custom highlight style (no underlines on headings)
export const woxHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: "bold", color: "#8bbd25", textDecoration: "none" },
  { tag: tags.heading2, fontWeight: "bold", color: "#4caf50", textDecoration: "none" },
  { tag: tags.heading3, fontWeight: "bold", color: "#3baea0", textDecoration: "none" },
  { tag: tags.heading4, fontWeight: "bold", color: "#719cd6", textDecoration: "none" },
  { tag: tags.heading5, fontWeight: "bold", color: "#9c8aef", textDecoration: "none" },
  { tag: tags.heading6, fontWeight: "bold", color: "#d99aee", textDecoration: "none" },
  { tag: tags.heading, fontWeight: "bold", color: "#d8dee9", textDecoration: "none" },
  { tag: tags.emphasis, fontStyle: "italic" },
  { tag: tags.strong, fontWeight: "bold" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.processingInstruction, color: "#a0b0c8" },
  { tag: tags.keyword, color: "#88C0D0" },
  { tag: [tags.atom, tags.bool, tags.url, tags.contentSeparator, tags.labelName, tags.inserted, tags.deleted, tags.literal], color: "#81A1C1" },
  { tag: [tags.string, tags.special(tags.string), tags.regexp, tags.escape], color: "#A3BE8C" },
  { tag: [tags.number, tags.character, tags.unit], color: "#B48EAD" },
  { tag: tags.meta, color: "#5E81AC" },
  { tag: tags.comment, color: "#616E88", fontStyle: "italic" },
  { tag: tags.link, color: "#88C0D0", textDecoration: "underline" },
  { tag: tags.monospace, fontFamily: "var(--code-font, monospace)" },
  { tag: tags.list, color: "var(--cm-text, #D8DEE9)" },
  { tag: tags.quote, color: "var(--cm-blockquote-color, #81A1C1)" },
  { tag: tags.content, color: "var(--cm-text, #D8DEE9)" },
  { tag: tags.punctuation, color: "var(--cm-gutter-color, #a0b0c8)" },
]);

export const CSS = `/* =========================================================
   Obsidian-style Live Preview CSS - WoxNote
   ========================================================= */

/* -- Core editor -- */
.cm-editor { height: 100% !important; background: var(--nord0, #2E3440); }
.cm-scroller { overflow: auto !important; height: 100% !important; }

/* Selection background — bypass CodeMirror theme variables */
.cm-editor .cm-selectionBackground,
.cm-editor.cm-focused .cm-selectionBackground {
  background: rgba(94, 129, 172, 0.45) !important;
}
.theme-light .cm-editor .cm-selectionBackground,
.theme-light .cm-editor.cm-focused .cm-selectionBackground {
  background: rgba(66, 133, 244, 0.32) !important;
}

.cm-editor .cm-content,
.cm-editor .cm-line {
  font-family: var(--ui-font, "HarmonyOS Sans", sans-serif) !important;
}

/* Light mode text — black, not gray */
.theme-light .cm-editor .cm-content,
.theme-light .cm-editor .cm-line {
  color: #000 !important;
}

/* =========================================================
   HEADINGS - no underlines
   ========================================================= */
.cm-editor .cm-line,
.cm-editor .cm-content * {
  text-decoration: none !important;
}
.cm-editor .cm-line {
  border-bottom: none !important;
}
/* .cm-editor u, .cm-editor u *,
.cm-editor [class*="tok-heading"],
.cm-editor [class*="heading"] {
  text-decoration: none !important;
  border-bottom: none !important;
} */
.cm-editor .cm-md-underline { text-decoration: underline !important; }
.cm-editor .cm-strikethrough, .cm-editor .tok-strikethrough { text-decoration: line-through !important; }
.cm-editor .cm-md-link, .cm-editor .tok-link { text-decoration: underline !important; }

.cm-editor .cm-md-heading-text { font-weight: 700 !important; }

.cm-editor .cm-md-heading-1, .cm-editor .cm-md-heading-2,
.cm-editor .cm-md-heading-3, .cm-editor .cm-md-heading-4,
.cm-editor .cm-md-heading-5, .cm-editor .cm-md-heading-6 {
  margin-top: 0 !important; margin-bottom: 0 !important;
  padding-top: 0 !important; padding-bottom: 0 !important;
}
.cm-editor .cm-md-heading-text.cm-md-heading-1 { font-size: 28px !important; color: #8bbd25 !important; line-height: 36px !important; }
.cm-editor .cm-md-heading-text.cm-md-heading-2 { font-size: 24px !important; color: #4caf50 !important; line-height: 32px !important; }
.cm-editor .cm-md-heading-text.cm-md-heading-3 { font-size: 20px !important; color: #3baea0 !important; line-height: 28px !important; }
.cm-editor .cm-md-heading-text.cm-md-heading-4 { font-size: 18px !important; color: #719cd6 !important; line-height: 26px !important; }
.cm-editor .cm-md-heading-text.cm-md-heading-5 { font-size: 16px !important; color: #9c8aef !important; line-height: 24px !important; }
.cm-editor .cm-md-heading-text.cm-md-heading-6 { font-size: 14px !important; color: #d99aee !important; line-height: 22px !important; }

/* =========================================================
   INLINE FORMATTING
   ========================================================= */
.cm-editor .cm-md-bold { font-weight: 700 !important; color: #d8dee9; }
.cm-editor .cm-md-italic { font-style: italic !important; color: #d8dee9; }
.cm-editor .cm-md-strikethrough { text-decoration: line-through !important; color: #7f8a96; }
.cm-editor .cm-md-highlight { background: rgba(235,203,139,0.3); color: #d8dee9; padding: 0 2px; border-radius: 3px; }
.cm-editor .cm-md-underline { text-decoration: underline !important; color: #d8dee9; }
.cm-editor .cm-md-code {
  background: rgba(76,86,106,0.35);
  color: #d8dee9;
  font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
  font-size: 0.9em; padding: 1px 4px; border-radius: 4px;
}
.cm-editor .cm-md-link { color: #88C0D0; text-decoration: underline; cursor: pointer; }
.cm-editor .cm-md-tag { color: #81A1C1; background: rgba(129,161,193,0.1); border-radius: 3px; padding: 0 2px; }
.cm-editor .cm-md-list-number { color: #88C0D0; font-weight: 600; margin-right: 4px; }

.cm-editor .cm-md-task-marker { color: #7eb8ff; }

/* =========================================================
   CODE BLOCKS - frame with rounded corners
   ========================================================= */
.cm-editor .cm-md-fenced-line {
  background: rgba(24, 29, 41, 0.85);
  border-left: 1px solid rgba(76, 86, 106, 0.6) !important;
  border-right: 1px solid rgba(76, 86, 106, 0.6) !important;
  font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace !important;
  font-size: 0.88em;
}

/* Opening fence line frame — rounded top, flat bottom */
.cm-editor .cm-md-fence-open {
  background: rgba(36, 42, 56, 0.9) !important;
  border: 1px solid rgba(76, 86, 106, 0.6) !important;
  border-top: 1px solid rgba(76, 86, 106, 0.6) !important;
  border-left: 1px solid rgba(76, 86, 106, 0.6) !important;
  border-right: 1px solid rgba(76, 86, 106, 0.6) !important;
  border-bottom: none !important;
  border-radius: 8px 8px 0 0 !important;
}
/* Closing fence line frame — flat top, rounded bottom */
.cm-editor .cm-md-fence-close {
  background: rgba(36, 42, 56, 0.9) !important;
  border: 1px solid rgba(76, 86, 106, 0.6) !important;
  border-left: 1px solid rgba(76, 86, 106, 0.6) !important;
  border-right: 1px solid rgba(76, 86, 106, 0.6) !important;
  border-bottom: 1px solid rgba(76, 86, 106, 0.6) !important;
  border-top: none !important;
  border-radius: 0 0 8px 8px !important;
}
/* Dimmed fence markers (\\\) on opening/closing lines */
.cm-editor .cm-md-fence-mark {
  color: rgba(163, 190, 204, 0.35) !important;
  user-select: none !important;
  font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace !important;
}
/* Language label widget — badge style */
.cm-editor .cm-md-code-info-wrap {
  display: inline;
}
.cm-editor .cm-md-code-info-text { display: inline; }
.cm-editor .cm-md-code-info-copied { 
  color: #A3BE8C !important;
  font-weight: 600;
}
.cm-editor .cm-md-code-info {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.78em;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 0 0 6px 6px;
  background: rgba(94, 129, 172, 0.42);
  color: #C0DEFF;
  letter-spacing: 0.3px;
  user-select: none;
  vertical-align: middle;
  font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace !important;
  border: 1px solid rgba(94, 129, 172, 0.5) !important;
  border-top: none !important;
  cursor: pointer;
  transition: all 0.15s ease;
}
.cm-editor .cm-md-code-info:hover {
  background: rgba(94, 129, 172, 0.6);
  color: #B8D4FF;
  border-color: rgba(94, 129, 172, 0.55);
}
.cm-editor .cm-md-code-info-edit {
  color: #88C0D0 !important;
  font-size: 0.85em;
  font-weight: 600;
  font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", "Consolas", monospace !important;
  background: rgba(136, 192, 208, 0.22) !important;
  padding: 2px 8px !important;
  border-radius: 4px !important;
  border: 1px solid rgba(136, 192, 208, 0.35) !important;
  display: inline !important;
}

/* =========================================================
   BLOCKQUOTES
   ========================================================= */
.cm-editor .cm-md-blockquote {
  box-shadow: inset 3px 0 0 var(--cm-bq-border, #4C566A);
  background: rgba(76,86,106,0.08);
  margin-left: 0;
  padding-left: 10px;
  color: #c0c8d4;
}

/* =========================================================
   HORIZONTAL RULES
   ========================================================= */
.cm-editor .cm-md-hr {
  position: relative;
  border-bottom: none !important;
}
.cm-editor .cm-md-hr::after {
  content: '';
  position: absolute;
  left: 6px;
  right: 6px;
  bottom: 50%;
  height: 2px;
  background: var(--cm-hr-border, #434C5E);
}


/* =========================================================
   TABLES — full visual rendering
   ========================================================= */
/* === Rendered HTML table widget (reading mode) === */
.cm-editor .cm-md-table-wrapper {
  margin: 8px 0;
  overflow-x: auto;
}
.cm-editor .cm-md-table {
  border-collapse: collapse;
  width: 100%;
  font-size: 0.92em;
  border: 1px solid #4C566A;
  border-radius: 6px;
  overflow: hidden;
}
.cm-editor .cm-md-table thead th {
  background: rgba(59, 66, 82, 0.95);
  color: #E5E9F0;
  font-weight: 700;
  padding: 8px 14px;
  border-bottom: 2px solid #88C0D0;
  border-right: 1px solid #4C566A;
  text-align: left;
  white-space: nowrap;
}
.cm-editor .cm-md-table thead th:last-child {
  border-right: none;
}
.cm-editor .cm-md-table tbody td {
  padding: 6px 14px;
  color: #D8DEE9;
  border-bottom: 1px solid rgba(76, 86, 106, 0.4);
  border-right: 1px solid rgba(76, 86, 106, 0.25);
}
.cm-editor .cm-md-table tbody td:last-child {
  border-right: none;
}
.cm-editor .cm-md-table tbody tr:last-child td {
  border-bottom: none;
}
.cm-editor .cm-md-table tbody tr:nth-child(even) td {
  background: rgba(46, 52, 64, 0.45);
}
.cm-editor .cm-md-table tbody tr:nth-child(odd) td {
  background: rgba(46, 52, 64, 0.18);
}

/* === Edit-mode raw markdown table (cursor on table) === */
.cm-editor .cm-md-table-header {
  background: rgba(59, 66, 82, 0.9) !important;
  font-weight: 700 !important;
  color: #E5E9F0 !important;
  letter-spacing: 0.4px;
  border-top: 1px solid #88C0D0 !important;
  border-bottom: 1px solid #88C0D0 !important;
}
.cm-editor .cm-md-table-header .cm-md-table-pipe {
  color: #88C0D0 !important;
  font-weight: 700;
  padding: 0 8px !important;
}
.cm-editor .cm-md-table-sep-mark {
  color: #4C566A !important;
  font-size: 0.7em;
  letter-spacing: 2px;
  user-select: none !important;
  background: rgba(46, 52, 64, 0.5) !important;
}
.cm-editor .cm-md-table-row-even {
  background: rgba(46, 52, 64, 0.55) !important;
}
.cm-editor .cm-md-table-row-odd {
  background: rgba(46, 52, 64, 0.25) !important;
}
.cm-editor .cm-md-table-row-even .cm-md-table-pipe,
.cm-editor .cm-md-table-row-odd .cm-md-table-pipe {
  color: #4C566A !important;
  padding: 0 8px !important;
  user-select: none !important;
}
.cm-editor .cm-md-table-pipe,
.cm-editor .cm-md-table-pipe * {
  color: #88C0D0 !important;
  font-weight: 700 !important;
  user-select: none !important;
  padding: 0 8px !important;
  background: rgba(136,192,208,0.08) !important;
}
.cm-editor .cm-md-table-header .cm-md-table-pipe,
.cm-editor .cm-md-table-header .cm-md-table-pipe * {
  color: #88C0D0 !important;
  font-weight: 700;
}
.cm-editor .cm-md-table-sep-mark .cm-md-table-pipe,
.cm-editor .cm-md-table-sep-mark .cm-md-table-pipe * {
  color: #4C566A !important;
}
/* =========================================================
   TASKS
   ========================================================= */
.cm-editor .cm-md-task-marker { color: #7eb8ff; }

/* =========================================================
   CALLOUTS — admonition blocks
   ========================================================= */
.cm-editor .cm-md-callout {
  border-radius: 0;
  padding-left: 16px;
  padding-right: 16px;
  box-shadow: inset 4px 0 0;
}
.cm-editor .cm-md-callout-note { background: rgba(94,129,172,0.12); box-shadow: inset 4px 0 0 #448aff; color: #b0cfff; }
.cm-editor .cm-md-callout-warning { background: rgba(235,203,139,0.12); box-shadow: inset 4px 0 0 #ffc107; color: #ffe08a; }
.cm-editor .cm-md-callout-danger { background: rgba(191,97,106,0.12); box-shadow: inset 4px 0 0 #ff5252; color: #ffa4a4; }
.cm-editor .cm-md-callout-tip { background: rgba(163,190,140,0.12); box-shadow: inset 4px 0 0 #00e676; color: #8ff5c4; }
.cm-editor .cm-md-callout-info { background: rgba(136,192,208,0.12); box-shadow: inset 4px 0 0 #00b0ff; color: #9edcff; }
.cm-editor .cm-md-callout-example { background: rgba(180,142,173,0.12); box-shadow: inset 4px 0 0 #d500f9; color: #e8b0ff; }
.cm-editor .cm-md-callout-quote { background: rgba(76,86,106,0.12); box-shadow: inset 4px 0 0 #9e9e9e; color: #c5c5c5; }
.cm-editor .cm-md-callout-success { background: rgba(163,190,140,0.12); box-shadow: inset 4px 0 0 #00c853; color: #8ff5c4; }
/* Callout title */
.cm-editor .cm-md-callout-title {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  opacity: 0.9;
}
/* Callout badge — [!type] colored pill */
.cm-editor .cm-md-callout-badge {
  display: inline;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 0.82em;
  padding: 1px 6px;
  border-radius: 4px;
  letter-spacing: 0.3px;
  margin-right: 4px;
  line-height: inherit;
}
.cm-editor .cm-md-callout-badge-note { background: rgba(68,138,255,0.25); color: #90c2ff; }
.cm-editor .cm-md-callout-badge-warning { background: rgba(255,193,7,0.2); color: #ffd54f; }
.cm-editor .cm-md-callout-badge-danger { background: rgba(255,82,82,0.2); color: #ff8a80; }
.cm-editor .cm-md-callout-badge-tip { background: rgba(0,230,118,0.2); color: #69f0ae; }
.cm-editor .cm-md-callout-badge-info { background: rgba(0,176,255,0.2); color: #80d8ff; }
.cm-editor .cm-md-callout-badge-example { background: rgba(213,0,249,0.2); color: #ea80fc; }
.cm-editor .cm-md-callout-badge-quote { background: rgba(158,158,158,0.2); color: #bdbdbd; }
.cm-editor .cm-md-callout-badge-success { background: rgba(0,200,83,0.2); color: #69f0ae; }

/* Callout badge in edit mode */
.cm-editor .cm-md-callout-badge-edit {
  opacity: 0.6 !important;
}

/* =========================================================
   LIST MARKERS — bullet and numbered
   ========================================================= */
/* Bullet widget — clean bullet replacement */
.cm-editor .cm-md-list-bullet {
  color: #88C0D0 !important;
  margin-right: 4px;
  font-weight: 700;
}
/* Hide old marker approach (fallback) */
.cm-editor .cm-md-list-bullet-mark {
  color: transparent !important;
}
.cm-editor .cm-md-list-bullet-mark::before {
  content: "\u2022";
  color: #88C0D0 !important;
  margin-right: 4px;
  font-weight: 700;
}
/* Ordered list numbers */
.cm-editor .cm-md-list-number {
  color: #88C0D0 !important;
  font-weight: 600 !important;
  margin-right: 2px;
}

/* =========================================================
   MARKER DIMMING — hide syntax in reading mode
   ========================================================= */
.cm-editor .cm-md-marker-dim {
  opacity: 0 !important;
  user-select: none !important;
  pointer-events: none !important;
}
.cm-editor .cm-md-marker-edit {
  opacity: 0.6 !important;
  user-select: none !important;
}

/* =========================================================
   IMAGES
   ========================================================= */
.cm-editor .cm-md-image-container { display: block; text-align: center; margin: 12px 0; }
.cm-editor .cm-md-image-container img { max-width: 100%; max-height: 500px; border-radius: 8px; }`;
