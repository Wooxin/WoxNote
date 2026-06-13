import { EditorView, Decoration, DecorationSet, WidgetType } from "@codemirror/view";
import { EditorState, RangeSetBuilder, StateField, StateEffect } from "@codemirror/state";
import type { Text } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode } from "@lezer/common";

// ── Cached wiki-link / tag positions ───────────────────────
type WikiRange = { from: number; to: number; isTag: boolean };
type CacheEntry = { ranges: WikiRange[]; doc: Text } | null;
let wikiCache: CacheEntry = null;

const MAX_LIVE_PREVIEW_CHARS = 200_000;
const MAX_LIVE_PREVIEW_LINES = 5_000;

export let _editorFocused = false;
export function setEditorFocused(v: boolean) { _editorFocused = v; }
export function isEditorFocused() { return _editorFocused; }

// ── Image handling ───────────────────────────────────────
let _vaultPath = "";
export function setVaultPath(p: string) { _vaultPath = p; }
export function resolveImageSrc(src: string): string {
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  if (!_vaultPath) return src;
  const cleanSrc = src.replace(/\\/g, "/");
  if (cleanSrc.startsWith("/")) return `asset://localhost/${encodeURIComponent(cleanSrc.slice(1))}`;
  return `asset://localhost/${encodeURIComponent(_vaultPath.replace(/\\/g, "/") + "/" + cleanSrc)}`;
}

export class ImageWidget extends WidgetType {
  constructor(readonly src: string, readonly alt: string) { super(); }
  toDOM() {
    const container = document.createElement("span");
    container.className = "cm-md-image-container";
    container.style.cssText = "display:block;text-align:center;margin:8px 0";
    const img = document.createElement("img");
    img.src = resolveImageSrc(this.src);
    img.alt = this.alt;
    img.style.cssText = "max-width:100%;max-height:480px;border-radius:6px;cursor:pointer";
    img.onerror = () => { container.textContent = `[Image: ${this.alt || this.src}]`; container.style.cssText = "color:#7f8a96;font-style:italic;padding:8px;text-align:center"; };
    container.appendChild(img);
    return container;
  }
}

// ── Zero-width widget for hiding markers ─────────────────

// ── Table widget for rendered HTML tables ──
class TableWidget extends WidgetType {
  constructor(readonly text: string, readonly pos: number) { super(); }
  eq(other: WidgetType) { return other instanceof TableWidget && this.text === other.text && this.pos === other.pos; }
  toDOM(view: EditorView): HTMLElement {
    const rawRows = this.text.trim().split(/\n/).filter((r: string) => r.trim());
    // Find separator row (|---|) and exclude it
    const sepIdx = rawRows.findIndex((r: string) => /^\s*\|[\s\-:|]+\|/.test(r));
    const dataRows = sepIdx >= 0 ? rawRows.filter((_row: string, i: number) => i !== sepIdx) : rawRows;
    if (dataRows.length === 0) {
      const empty = document.createElement("span");
      empty.textContent = "";
      return empty;
    }
    const wrapper = document.createElement("span");
    wrapper.className = "cm-md-table-wrapper";
    const table = document.createElement("table");
    table.className = "cm-md-table";
    const thead = document.createElement("thead");
    const tbody = document.createElement("tbody");
    for (let j = 0; j < dataRows.length; j++) {
      const cells = dataRows[j].split("|").map((c: string) => c.trim()).filter((c: string) => c !== "");
      if (cells.length === 0) continue;
      const tr = document.createElement("tr");
      if (j === 0) {
        for (const cell of cells) { const th = document.createElement("th"); th.textContent = cell; tr.appendChild(th); }
        thead.appendChild(tr);
      } else {
        for (const cell of cells) { const td = document.createElement("td"); td.textContent = cell; tr.appendChild(td); }
        tbody.appendChild(tr);
      }
    }
    table.appendChild(thead); table.appendChild(tbody);
    wrapper.appendChild(table);
    // Click to enter edit mode: place cursor at table position
    wrapper.addEventListener("click", (e) => {
      e.stopPropagation();
      view.dispatch({
        selection: { anchor: this.pos },
        scrollIntoView: true,
      });
      view.focus();
    });
    return wrapper;
  }
  ignoreEvent() { return false; }
}

class ZwWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-md-zero-width";
    return span;
  }
  eq() { return true; }
}

// ── Bullet widget — replaces list markers (-, *, +) ──
class BulletWidget extends WidgetType {
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-md-list-bullet";
    span.textContent = "\u2022";
    return span;
  }
  eq() { return true; }
}

class TaskCheckboxWidget extends WidgetType {
  constructor(readonly from: number, readonly checked: boolean) { super(); }
  eq(other: WidgetType) { return other instanceof TaskCheckboxWidget && this.checked === other.checked; }
  toDOM(view: EditorView): HTMLElement {
    const box = document.createElement("span");
    box.className = "cm-md-task-checkbox" + (this.checked ? " checked" : "");
    box.textContent = this.checked ? "\u2713" : "";
    box.setAttribute("role", "checkbox");
    box.setAttribute("aria-checked", this.checked ? "true" : "false");
    box.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      view.dispatch({
        changes: { from: this.from + 1, to: this.from + 2, insert: this.checked ? " " : "x" },
      });
      view.focus();
    });
    return box;
  }
  ignoreEvent() { return false; }
}

// ── Font color widget — renders <font color="...">text</font> ──
class FontColorWidget extends WidgetType {
  constructor(readonly color: string, readonly text: string) { super(); }
  eq(other: WidgetType) { return other instanceof FontColorWidget && this.color === other.color && this.text === other.text; }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.style.color = this.color;
    span.textContent = this.text;
    return span;
  }
}

// ── Code info widget — language badge with click-to-copy ──
class CodeInfoWidget extends WidgetType {
  constructor(readonly lang: string, readonly code: string) { super(); }
  eq(other: WidgetType) { return other instanceof CodeInfoWidget && this.lang === other.lang && this.code === other.code; }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "cm-md-code-info";
    span.textContent = this.lang;
    span.addEventListener("click", (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(this.code).then(() => {
        span.textContent = "\u2713 Copied";
        span.classList.add("cm-md-code-info-copied");
        setTimeout(() => {
          span.textContent = this.lang;
          span.classList.remove("cm-md-code-info-copied");
        }, 2000);
      }).catch(() => {});
    });
    return span;
  }
  ignoreEvent() { return false; }
}

// ── Structured ranges (lines handled by tree, regex must skip) ──
interface BlockRange { from: number; to: number; }

function collectStructuredRanges(tree: ReturnType<typeof syntaxTree>): BlockRange[] {
  const ranges: BlockRange[] = [];
  tree.iterate({
    enter(ref) {
      const kind = ref.node.name;
      if (kind.startsWith("ATXHeading") || kind.startsWith("SetextHeading") ||
          kind === "Table" || kind === "GFMTable" || kind === "CodeBlock" || kind === "FencedCode" ||
          kind === "HTMLBlock" || kind === "CommentBlock") {
        ranges.push({ from: ref.node.from, to: ref.node.to });
      }
    },
  });
  // Normalize: flatten overlapping/adjacent ranges
  if (ranges.length <= 1) return ranges;
  ranges.sort((a, b) => a.from - b.from);
  const merged: BlockRange[] = [];
  let cur = ranges[0];
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i].from <= cur.to) {
      cur.to = Math.max(cur.to, ranges[i].to);
    } else {
      merged.push(cur);
      cur = ranges[i];
    }
  }
  merged.push(cur);
  return merged;
}

function isInsideBlock(pos: number, blocks: BlockRange[]): boolean {
  for (const b of blocks) {
    if (pos >= b.from && pos < b.to) return true;
  }
  return false;
}






function buildDecorations(state: EditorState): DecorationSet {
  if (state.doc.length === 0) return Decoration.none;
  if (state.doc.length > MAX_LIVE_PREVIEW_CHARS || state.doc.lines > MAX_LIVE_PREVIEW_LINES) {
    return Decoration.none;
  }

  const b = new RangeSetBuilder<Decoration>();
  const sel = state.selection.main;
  const doc = state.doc;
  const selLineFrom = doc.lineAt(sel.from).from;
  const selLineTo = doc.lineAt(Math.max(sel.from, sel.to)).to;
  const focused = _editorFocused;

  const tree = syntaxTree(state);

  // ── Phase 1: Collect structured block ranges ──────────
  const structuredBlocks = collectStructuredRanges(tree);

  const decos: { from: number; to: number; deco: Decoration }[] = [];

  // ── Phase 2: Tree-pass: structural elements only ──────
  tree.iterate({
    enter(ref) {
      const node: SyntaxNode = ref.node;
      const from = node.from; const to = node.to; const kind = node.name;
      const lineOverlaps = focused && !(to <= selLineFrom || from >= selLineTo);

      // ── Headings ────────────────────────────────────
      if (kind.startsWith("ATXHeading") || kind.startsWith("SetextHeading")) {
        let level = 1;
        const m = kind.match(/(\d+)$/);
        if (m) level = parseInt(m[1], 10);
        let headerMarkEnd = from;
        for (const c of childrenOf(node)) {
          if (c.name === "HeaderMark") {
            decos.push({ from: c.from, to: c.to, deco: lineOverlaps ? Decoration.mark({ class: "cm-md-marker-edit" }) : Decoration.replace({ widget: new ZwWidget(), block: false }) });
            headerMarkEnd = c.to;
          }
        }
        if (headerMarkEnd < to) {
          decos.push({ from: headerMarkEnd, to, deco: Decoration.mark({ class: "cm-md-heading-text cm-md-heading-" + level }) });
        }
      }

      // ── Tables: Obsidian-style live preview ──
      else if (kind === "Table" || kind === "GFMTable") {
        if (!lineOverlaps) {
          const tableText = doc.sliceString(from, to);
          decos.push({ from, to, deco: Decoration.replace({ widget: new TableWidget(tableText, from), block: true }) });
        } else {
          let rowIdx = 0;
          for (const child of childrenOf(node)) {
            const cFrom = child.from; const cTo = child.to; const cKind = child.name;
            if (cKind === "TableHeader" || cKind === "TableHead") {
              decos.push({ from: cFrom, to: cFrom, deco: Decoration.line({ class: "cm-md-table-header" }) });
              const headerText = doc.sliceString(cFrom, cTo);
              for (const pm of headerText.matchAll(/\|/g)) {
                const pipePos = cFrom + pm.index!;
                decos.push({ from: pipePos, to: pipePos + 1, deco: Decoration.mark({ class: "cm-md-table-pipe-edit" }) });
              }
            } else if (cKind === "TableDelimiter" || cKind === "TableSeparator") {
              decos.push({ from: cFrom, to: cTo, deco: Decoration.mark({ class: "cm-md-table-sep-mark" }) });
            } else if (cKind === "TableRow") {
              const rowClass = rowIdx % 2 === 0 ? "cm-md-table-row-even" : "cm-md-table-row-odd";
              rowIdx++;
              decos.push({ from: cFrom, to: cFrom, deco: Decoration.line({ class: rowClass }) });
              const rowText = doc.sliceString(cFrom, cTo);
              for (const pm of rowText.matchAll(/\|/g)) {
                const pipePos = cFrom + pm.index!;
                decos.push({ from: pipePos, to: pipePos + 1, deco: Decoration.mark({ class: "cm-md-table-pipe-edit" }) });
              }
            }
          }
        }
      }

      // ── Code Blocks ─
      else if (kind === "FencedCode" || kind === "CodeBlock") {
        // Collect code block info in a single pass
        let openFenceFrom = 0, openFenceTo = 0, langName = "";
        let closeFenceFrom = 0, closeFenceTo = 0;
        let codeFrom = 0, codeTo = 0;
        let tickLen = 3;
        for (const child of childrenOf(node)) {
          if (child.name === "CodeMark") {
            const cmText = doc.sliceString(child.from, child.to);
            const tm = cmText.match(/^(`{3,}|~{3,})/);
            if (tm) {
              if (!openFenceFrom) {
                openFenceFrom = child.from; openFenceTo = child.to;
                tickLen = tm[1].length;
                langName = cmText.slice(tickLen).trim();
              } else {
                closeFenceFrom = child.from; closeFenceTo = child.to;
              }
            }
          } else if (child.name === "CodeText") {
            if (!codeFrom) { codeFrom = child.from; codeTo = child.to; }
          }
        }

        const codeText = codeFrom ? doc.sliceString(codeFrom, codeTo) : "";

        if (!lineOverlaps) {
          // Opening fence line
          decos.push({ from: openFenceFrom, to: openFenceFrom, deco: Decoration.line({ class: "cm-md-fence-open" }) });
          decos.push({ from: openFenceFrom, to: openFenceFrom + tickLen, deco: Decoration.replace({ widget: new ZwWidget(), block: false }) });
          if (langName) {
            decos.push({ from: openFenceFrom + tickLen, to: openFenceTo, deco: Decoration.replace({ widget: new CodeInfoWidget(langName, codeText), block: false }) });
          }

          // Code text lines
          if (codeFrom) {
            const sLine = doc.lineAt(codeFrom);
            const eLine = doc.lineAt(Math.max(codeFrom, codeTo - 1));
            for (let i = sLine.number; i <= eLine.number; i++) {
              const ln = doc.line(i);
              decos.push({ from: ln.from, to: ln.from, deco: Decoration.line({ class: "cm-md-fenced-line" }) });
            }
          }

          // Closing fence line
          if (closeFenceFrom) {
            decos.push({ from: closeFenceFrom, to: closeFenceFrom, deco: Decoration.line({ class: "cm-md-fence-close" }) });
            decos.push({ from: closeFenceFrom, to: closeFenceTo, deco: Decoration.replace({ widget: new ZwWidget(), block: false }) });
          }
        } else {
          // Edit mode: show raw markers dimmed
          if (openFenceFrom) {
            decos.push({ from: openFenceFrom, to: openFenceFrom, deco: Decoration.line({ class: "cm-md-fence-open-edit" }) });
            decos.push({ from: openFenceFrom, to: openFenceFrom + tickLen, deco: Decoration.mark({ class: "cm-md-marker-edit" }) });
            if (openFenceFrom + tickLen < openFenceTo) {
              decos.push({ from: openFenceFrom + tickLen, to: openFenceTo, deco: Decoration.mark({ class: "cm-md-code-info-edit" }) });
            }
          }
          if (codeFrom) {
            const sLine = doc.lineAt(codeFrom);
            const eLine = doc.lineAt(Math.max(codeFrom, codeTo - 1));
            for (let i = sLine.number; i <= eLine.number; i++) {
              const ln = doc.line(i);
              decos.push({ from: ln.from, to: ln.from, deco: Decoration.line({ class: "cm-md-fenced-line-edit" }) });
            }
          }
          if (closeFenceFrom) {
            decos.push({ from: closeFenceFrom, to: closeFenceFrom, deco: Decoration.line({ class: "cm-md-fence-close-edit" }) });
            decos.push({ from: closeFenceFrom, to: closeFenceTo, deco: Decoration.mark({ class: "cm-md-marker-edit" }) });
          }
        }
      }

      // ── Blockquotes ──
      else if (kind === "Blockquote") {
        const startLine = doc.lineAt(from);
        const endLine = doc.lineAt(Math.max(from, to - 1));
        const firstText = startLine.text;
        const calloutMatch = firstText.match(/^(\s*)>\s*\[!([^\]]+)\]\s*(.*)/i);
        if (calloutMatch) {
          const calloutType = calloutMatch[2].toLowerCase();
          const typeMap: Record<string, string> = {
            "note": "note", "提示": "note",
            "warning": "warning", "警告": "warning",
            "danger": "danger", "危险": "danger",
            "tip": "tip", "贴士": "tip",
            "info": "info", "信息": "info",
            "example": "example", "示例": "example",
            "quote": "quote", "引用": "quote",
            "success": "success", "成功": "success",
          };
          const typeClass = typeMap[calloutType] || "note";
          const bracketIdx = firstText.indexOf("[!");
          const closeIdx = firstText.indexOf("]", bracketIdx);
          for (let i = startLine.number; i <= endLine.number; i++) {
            const ln = doc.line(i);
            const perLineOverlaps = focused && !(ln.to <= selLineFrom || ln.from >= selLineTo);
            decos.push({ from: ln.from, to: ln.from, deco: Decoration.line({ class: "cm-md-callout cm-md-callout-" + typeClass }) });
            const pm = ln.text.match(/^(\s*)>\s?/);
            if (pm) {
              decos.push({ from: ln.from, to: ln.from + pm[0].length, deco: perLineOverlaps ? Decoration.mark({ class: "cm-md-marker-edit" }) : Decoration.replace({ widget: new ZwWidget(), block: false }) });
            }
            if (i === startLine.number && bracketIdx >= 0 && closeIdx > bracketIdx) {
              const badgeClass = perLineOverlaps
                ? "cm-md-callout-badge cm-md-callout-badge-" + typeClass + " cm-md-callout-badge-edit"
                : "cm-md-callout-badge cm-md-callout-badge-" + typeClass;
              decos.push({ from: ln.from + bracketIdx, to: ln.from + closeIdx + 1, deco: Decoration.mark({ class: badgeClass }) });
              const titleStart = ln.from + closeIdx + 2;
              if (titleStart < ln.to) {
                decos.push({ from: titleStart, to: ln.to, deco: Decoration.mark({ class: "cm-md-callout-title" }) });
              }
            }
          }
        } else {
          for (let i = startLine.number; i <= endLine.number; i++) {
            const ln = doc.line(i);
            const perLineOverlaps = focused && !(ln.to <= selLineFrom || ln.from >= selLineTo);
            decos.push({ from: ln.from, to: ln.from, deco: Decoration.line({ class: "cm-md-blockquote" }) });
            const m = ln.text.match(/^((?:\s*>)+)\s?/);
            if (m) {
              decos.push({ from: ln.from, to: ln.from + m[1].length, deco: perLineOverlaps ? Decoration.mark({ class: "cm-md-marker-edit" }) : Decoration.replace({ widget: new ZwWidget(), block: false }) });
            }
          }
        }
      }

      // ── Horizontal Rules ────────────────────────────
      else if (kind === "HorizontalRule") {
        decos.push({ from, to: from, deco: Decoration.line({ class: "cm-md-hr" }) });
        if (!lineOverlaps) {
          decos.push({ from, to, deco: Decoration.replace({ widget: new ZwWidget(), block: false }) });
        } else {
          decos.push({ from, to, deco: Decoration.mark({ class: "cm-md-marker-edit" }) });
        }
      }
    },
  });

  // ── Phase 2.5: HTML font color pass (all lines, no block skip) ──
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i); const text = line.text;
    const lineOverlaps = focused && !(line.to <= selLineFrom || line.from >= selLineTo);
    if (lineOverlaps) continue;
    for (const m of text.matchAll(/<font\s+color\s*=\s*["']([^"']+)["']\s*>(.*?)<\/font>/gi)) {
      const from = line.from + m.index!, to = from + m[0].length;
      decos.push({ from, to, deco: Decoration.replace({ widget: new FontColorWidget(m[1], m[2]), block: false }) });
    }
  }

  // ── Phase 3: Regex pass ──
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i); const text = line.text;
    const lineOverlaps = focused && !(line.to <= selLineFrom || line.from >= selLineTo);
    if (isInsideBlock(line.from, structuredBlocks)) continue;
    // Bold
    for (const m of text.matchAll(/\*\*([^*]+)\*\*/g)) {
      const from = line.from + m.index!, to = from + m[0].length;
      const mk = lineOverlaps ? "cm-md-marker-edit" : "cm-md-marker-dim";
      decos.push({ from, to: from + 2, deco: Decoration.mark({ class: mk }) });
      decos.push({ from: from + 2, to: to - 2, deco: Decoration.mark({ class: "cm-md-bold" }) });
      decos.push({ from: to - 2, to, deco: Decoration.mark({ class: mk }) });
    }
    // Italic
    for (const m of text.matchAll(/(?<!\*)\*([^*\n]+)\*(?!\*)/g)) {
      const from = line.from + m.index!, to = from + m[0].length;
      const mk = lineOverlaps ? "cm-md-marker-edit" : "cm-md-marker-dim";
      decos.push({ from, to: from + 1, deco: Decoration.mark({ class: mk }) });
      decos.push({ from: from + 1, to: to - 1, deco: Decoration.mark({ class: "cm-md-italic" }) });
      decos.push({ from: to - 1, to, deco: Decoration.mark({ class: mk }) });
    }
    // Inline code
    for (const m of text.matchAll(/`([^`]+)`/g)) {
      const from = line.from + m.index!, to = from + m[0].length;
      const mk = lineOverlaps ? "cm-md-marker-edit" : "cm-md-marker-dim";
      decos.push({ from, to: from + 1, deco: Decoration.mark({ class: mk }) });
      decos.push({ from: from + 1, to: to - 1, deco: Decoration.mark({ class: "cm-md-code" }) });
      decos.push({ from: to - 1, to, deco: Decoration.mark({ class: mk }) });
    }
    // Strikethrough
    for (const m of text.matchAll(/~~([^~]+)~~/g)) {
      const from = line.from + m.index!, to = from + m[0].length;
      const mk = lineOverlaps ? "cm-md-marker-edit" : "cm-md-marker-dim";
      decos.push({ from, to: from + 2, deco: Decoration.mark({ class: mk }) });
      decos.push({ from: from + 2, to: to - 2, deco: Decoration.mark({ class: "cm-md-strikethrough" }) });
      decos.push({ from: to - 2, to, deco: Decoration.mark({ class: mk }) });
    }
    // Highlight
    for (const m of text.matchAll(/==([^=]+)==/g)) {
      const from = line.from + m.index!, to = from + m[0].length;
      const mk = lineOverlaps ? "cm-md-marker-edit" : "cm-md-marker-dim";
      decos.push({ from, to: from + 2, deco: Decoration.mark({ class: mk }) });
      decos.push({ from: from + 2, to: to - 2, deco: Decoration.mark({ class: "cm-md-highlight" }) });
      decos.push({ from: to - 2, to, deco: Decoration.mark({ class: mk }) });
    }
    // Underline
    for (const m of text.matchAll(/\+\+([^+]+)\+\+/g)) {
      const from = line.from + m.index!, to = from + m[0].length;
      const mk = lineOverlaps ? "cm-md-marker-edit" : "cm-md-marker-dim";
      decos.push({ from, to: from + 2, deco: Decoration.mark({ class: mk }) });
      decos.push({ from: from + 2, to: to - 2, deco: Decoration.mark({ class: "cm-md-underline" }) });
      decos.push({ from: to - 2, to, deco: Decoration.mark({ class: mk }) });
    }
    // Link [text](url)
    for (const m of text.matchAll(/(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g)) {
      const from = line.from + m.index!, to = from + m[0].length;
      const textStart = from + 1; const textEnd = textStart + m[1].length;
      if (!lineOverlaps) {
        decos.push({ from, to: textStart, deco: Decoration.replace({ widget: new ZwWidget(), block: false }) });
        decos.push({ from: textStart, to: textEnd, deco: Decoration.mark({
          class: "cm-md-link",
          attributes: { style: "cursor:pointer;text-decoration:underline" }
        }) });
        decos.push({ from: textEnd, to, deco: Decoration.replace({ widget: new ZwWidget(), block: false }) });
      } else {
        decos.push({ from, to: textStart, deco: Decoration.mark({ class: "cm-md-marker-edit" }) });
        decos.push({ from: textStart, to: textEnd, deco: Decoration.mark({ class: "cm-md-link" }) });
        decos.push({ from: textEnd, to, deco: Decoration.mark({ class: "cm-md-marker-edit" }) });
      }
    }
    // Image ![alt](url)
    for (const m of text.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)) {
      const from = line.from + m.index!, to = from + m[0].length;
      if (!lineOverlaps) {
        decos.push({ from, to, deco: Decoration.replace({
          widget: new ImageWidget(m[2], m[1]),
          block: false,
        }) });
      } else {
        decos.push({ from, to: from + 2, deco: Decoration.mark({ class: "cm-md-marker-edit" }) });
        decos.push({ from: to - 1, to, deco: Decoration.mark({ class: "cm-md-marker-edit" }) });
      }
    }
    const taskMatch = text.match(/^(\s*[-*+]\s+)\[([ xX])\]\s/);

    // List markers
    const listMatch = text.match(/^(\s*)([-*+]|\d+[.)])\s/);
    if (listMatch) {
      const indent = listMatch[1];
      const marker = listMatch[2];
      const markerFrom = line.from + indent.length;
      const markerTo = markerFrom + marker.length;
      const isOrdered = /^\d/.test(marker);
      const isTaskLine = Boolean(taskMatch);
      if (!lineOverlaps) {
        if (isTaskLine) {
          decos.push({ from: markerFrom, to: markerTo + 1, deco: Decoration.replace({ widget: new ZwWidget(), block: false }) });
        } else if (isOrdered) {
          decos.push({ from: markerFrom, to: markerTo + 1, deco: Decoration.mark({ class: "cm-md-list-number" }) });
        } else {
          decos.push({ from: markerFrom, to: markerTo + 1, deco: Decoration.replace({ widget: new BulletWidget(), block: false }) });
        }
      } else {
        decos.push({ from: markerFrom, to: markerTo, deco: Decoration.mark({ class: "cm-md-marker-edit" }) });
      }
    }
    // Task checkbox
    if (taskMatch) {
      const bracketPos = line.from + taskMatch[0].indexOf("[");
      const checked = taskMatch[2].toLowerCase() === "x";
      if (!lineOverlaps) {
        decos.push({ from: bracketPos, to: bracketPos + 3, deco: Decoration.replace({ widget: new TaskCheckboxWidget(bracketPos, checked), block: false }) });
        if (checked) {
          decos.push({ from: bracketPos + 4, to: line.to, deco: Decoration.mark({ class: "cm-md-task-done" }) });
        }
      } else {
        decos.push({ from: bracketPos, to: bracketPos + 3, deco: Decoration.mark({ class: "cm-md-task-marker" }) });
      }
    }
  }

  // ── Wiki links & tags ──
  if (!wikiCache || wikiCache.doc !== doc) {
    const ranges: WikiRange[] = [];
    for (let i = 1; i <= doc.lines; i++) {
      const line = doc.line(i); const text = line.text;
      for (const m of text.matchAll(/\[\[([^\]]+)\]\]/g))
        ranges.push({ from: line.from + m.index!, to: line.from + m.index! + m[0].length, isTag: false });
      for (const m of text.matchAll(/(?:^|\s)(#[A-Za-z0-9_\u{4e00}-\u{9fff}]+)/gu)) {
        const at = line.from + m.index! + m[0].indexOf("#");
        ranges.push({ from: at, to: at + m[1].length, isTag: true });
      }
    }
    wikiCache = { ranges, doc };
  }
  for (const r of wikiCache?.ranges || []) {
    if (isInsideBlock(r.from, structuredBlocks)) continue;
    const rOverlaps = focused && !(r.to <= selLineFrom || r.from >= selLineTo);
    if (r.isTag) {
      decos.push({ from: r.from, to: r.to, deco: Decoration.mark({ class: "cm-md-tag" }) });
    } else {
      const mk = rOverlaps ? "cm-md-marker-edit" : "cm-md-marker-dim";
      decos.push({ from: r.from, to: r.from + 2, deco: Decoration.mark({ class: mk }) });
      decos.push({ from: r.from + 2, to: r.to - 2, deco: Decoration.mark({ class: "cm-md-link" }) });
      decos.push({ from: r.to - 2, to: r.to, deco: Decoration.mark({ class: mk }) });
    }
  }

  // ── Sort & add ──
  decos.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return a.to - b.to;
  });
  for (const d of decos) {
    const from = d.from; const to = d.to;
    if (from < 0 || to > doc.length || from > to) continue;
    try { b.add(from, to, d.deco); } catch { /* skip */ }
  }
  return b.finish();
}

// ── Helpers ──────────────────────────────────────────────

export function* childrenOf(node: SyntaxNode): Generator<SyntaxNode> {
  let child = node.firstChild;
  while (child) { yield child; child = child.nextSibling; }
}

// ── State field ─────────────────────────────────────────
export const focusEffect = StateEffect.define<boolean>();

export const previewField = StateField.define<DecorationSet>({
  create(state) {
    try { return buildDecorations(state); }
    catch (e) { console.warn("CMLivePreview: create failed", e); return Decoration.none; }
  },
  update(decos, tr) {
    if (tr.docChanged || tr.selection || tr.effects.some(e => e.is(focusEffect))) {
      if (tr.docChanged) { wikiCache = null; }
      try { return buildDecorations(tr.state); }
      catch (e) { console.warn("CMLivePreview: update failed", e); return decos; }
    }
    return decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});
