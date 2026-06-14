import { useEffect, useRef } from "react";
import { EditorView, keymap, highlightActiveLine, ViewUpdate, drawSelection } from "@codemirror/view";
import { EditorState, Transaction, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab, redo } from "@codemirror/commands";
import { syntaxHighlighting } from "@codemirror/language";

// Module-level scroll-to-heading — accessible from any component
let _scrollToHeading: ((text: string) => void) | null = null;
export function scrollToHeading(text: string) { _scrollToHeading?.(text); }
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { closeBrackets, autocompletion } from "@codemirror/autocomplete";
import type { CompletionContext } from "@codemirror/autocomplete";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";

import { STYLE_ID, CSS, woxHighlightStyle } from "./styles";
import { setEditorFocused, isEditorFocused, focusEffect, previewField, setVaultPath } from "./decorations";
import { cmTheme, darkTheme } from "./theme";
import { appInvoke } from "../../bridge";
import type { EditorInsertRequest, LineRevealRequest } from "../../types";

// ── Props ───────────────────────────────────────────────────
type ScrollToHeadingFn = (text: string) => void;

type Props = {
  content: string; contentWidth: string; contentFontSize: string;
  noteTitles: string[];
  onContentChange: (v: string) => void;
  onPasteImage?: (dataUrl: string) => Promise<string | null>;
  onSave?: () => void;
  onClickWikiLink?: (title: string) => void;
  onClickTag?: (tag: string) => void;
  onScrollToHeading?: (fn: ScrollToHeadingFn) => void;
  onCursorChange?: (line: number, col: number) => void;
  revealLineRequest?: LineRevealRequest | null;
  insertTextRequest?: EditorInsertRequest | null;
  vaultPath?: string;
};


export function CMLivePreview({
  content, contentWidth, contentFontSize, noteTitles,
  onContentChange, onPasteImage, onSave, onClickWikiLink, onClickTag,
  onScrollToHeading, onCursorChange, revealLineRequest, insertTextRequest, vaultPath,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const titlesRef = useRef(noteTitles);
  const vaultPathRef = useRef(vaultPath);
  const callbacksRef = useRef({
    onContentChange,
    onPasteImage,
    onSave,
    onClickWikiLink,
    onClickTag,
    onCursorChange,
  });
  const syncingRef = useRef(false); // guard against double-sync
  const contentRef = useRef(content);
  titlesRef.current = noteTitles;
  vaultPathRef.current = vaultPath;
  contentRef.current = content;
  callbacksRef.current = {
    onContentChange,
    onPasteImage,
    onSave,
    onClickWikiLink,
    onClickTag,
    onCursorChange,
  };

  useEffect(() => { if (vaultPath) setVaultPath(vaultPath); }, [vaultPath]);

  // Inject CSS once on mount (HMR will remount)
  useEffect(() => {
    let s = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!s) {
      s = document.createElement("style");
      s.id = STYLE_ID;
      document.head.appendChild(s);
    }
    s.textContent = CSS;
  }, [CSS]);

  useEffect(() => {
    if (!ref.current || viewRef.current) return;

    const wikiCompletion = async (ctx: CompletionContext) => {
      const word = ctx.matchBefore(/\[\[[^\]]*$/);
      if (!word) return null;
      const typed = word.text.slice(2);

      try {
        const results = await appInvoke<{title: string; path: string; score: number}[]>(
          "fuzzy_match_titles",
          { query: typed, vaultPath: vaultPathRef.current || "" }
        );
        if (results && results.length > 0) {
          const options = results.map((r: {title: string; path: string; score: number}) => ({
            label: r.title,
            type: "text" as const,
            apply: r.title + "]]",
            detail: r.path,
          }));
          return { from: word.from + 2, options, filter: false };
        }
      } catch { /* fallback below */ }

      // Fallback: local includes matching
      const q = typed.toLowerCase();
      const matches = titlesRef.current
        .filter((t) => !q || t.toLowerCase().includes(q))
        .slice(0, 20)
        .map((t) => ({ label: t, type: "text" as const, apply: t + "]]", detail: "note" }));
      return matches.length ? { from: word.from + 2, options: matches, filter: false } : null;
    };

    const markdownKeymap = keymap.of([
      { key: "Enter", run: continueMarkdownList },
      { key: "Tab", run: indentMarkdownList },
      { key: "Shift-Tab", run: outdentMarkdownList },
      { key: "Mod-b", run: wrapInline("**") },
      { key: "Mod-i", run: wrapInline("*") },
      { key: "Mod-`", run: wrapInline("`") },
      { key: "Mod-k", run: wrapMarkdownLink },
      { key: "Mod-Enter", run: toggleTaskLine },
      { key: "Mod-Shift-h", run: wrapInline("==") },
      { key: "Mod-Shift-", run: wrapInline("") },
      { key: "Mod-Shift-s", run: wrapInline("~~") },
    ]);

    const exts: Extension[] = [
      previewField, cmTheme, darkTheme,
      history(),
      drawSelection(),
      highlightActiveLine(),
      markdown({ base: markdownLanguage, extensions: GFM }),
      syntaxHighlighting(woxHighlightStyle),
      EditorView.lineWrapping, closeBrackets(),
      autocompletion({ override: [wikiCompletion] }),
      keymap.of([
        { key: "Mod-Shift-z", run: redo },
        { key: "Mod-y", run: redo },
      ]),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      markdownKeymap,
      search({ top: true }),
      highlightSelectionMatches(),
      keymap.of(searchKeymap),
      EditorView.updateListener.of((u: ViewUpdate) => {
        if (u.docChanged) {
          if (!syncingRef.current) {
            syncingRef.current = true; // block external sync during user edits
            callbacksRef.current.onContentChange(u.state.doc.toString());
            // Reset on a macrotask; animation frames may pause in background windows.
            setTimeout(() => { syncingRef.current = false; }, 0);
          }
        }
        const onCursor = callbacksRef.current.onCursorChange;
        if (u.selectionSet && onCursor) {
          const pos = u.state.selection.main.head;
          const line = u.state.doc.lineAt(pos);
          onCursor(line.number, pos - line.from + 1);
        }
      }),
      EditorView.domEventHandlers({
        keydown: (event: KeyboardEvent, view: EditorView) => {
          if (handlePairTyping(event, view)) return true;
          return false;
        },
        dragover: (event: DragEvent) => {
          const files = Array.from(event.dataTransfer?.items ?? []);
          if (files.some((item) => item.kind === "file" && item.type.startsWith("image/"))) {
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
            view.dom.classList.add("cm-image-drop-target");
            return true;
          }
          return false;
        },
        dragleave: (_event: DragEvent, view: EditorView) => {
          view.dom.classList.remove("cm-image-drop-target");
          return false;
        },
        drop: (event: DragEvent, view: EditorView) => {
          view.dom.classList.remove("cm-image-drop-target");
          const onPasteImage = callbacksRef.current.onPasteImage;
          if (!onPasteImage) return false;
          const files = Array.from(event.dataTransfer?.files ?? []).filter((file) => file.type.startsWith("image/"));
          if (files.length === 0) return false;
          event.preventDefault();
          const dropPos = view.posAtCoords({ x: event.clientX, y: event.clientY }) ?? view.state.selection.main.head;
          void (async () => {
            const inserts: string[] = [];
            for (const file of files) {
              try {
                const dataUrl = await readFileAsDataUrl(file);
                const path = await onPasteImage(dataUrl);
                if (path) inserts.push(`![](${path})`);
              } catch { /* ignore unreadable image */ }
            }
            if (inserts.length > 0) {
              view.dispatch({
                changes: { from: dropPos, insert: inserts.join("\n") + "\n" },
                selection: { anchor: dropPos + inserts.join("\n").length + 1 },
              });
              view.focus();
            }
          })();
          return true;
        },
        click: (event: MouseEvent, view: EditorView) => {
          const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
          if (pos === null) return false;

          const clickLine = view.state.doc.lineAt(pos);
          const cursorLineNum = view.state.doc.lineAt(view.state.selection.main.head).number;
          const isOnEditLine = isEditorFocused() && clickLine.number === cursorLineNum;

          // Checkbox toggle: only in reading mode (non-cursor line)
          if (!isOnEditLine) {
            const taskMatch = clickLine.text.match(/^(\s*[-*+])\s+\[([ x])\]\s/);
            if (taskMatch) {
              const bracketPos = clickLine.from + taskMatch[0].indexOf("[");
              if (pos >= bracketPos && pos <= bracketPos + 3) {
                const newCheck = taskMatch[2] === "x" ? " " : "x";
                const newLine = clickLine.text.replace(/^(\s*[-*+])\s+\[([ x])\]/, `$1 [${newCheck}]`);
                view.dispatch({
                  changes: { from: clickLine.from, to: clickLine.to, insert: newLine },
                });
                return true;
              }
            }
          }

          // Wiki link click: [[title]]
          if (!isOnEditLine) {
            const lm = clickLine.text.match(/(\[\[([^\]]+)\]\])/);
            const onWikiLink = callbacksRef.current.onClickWikiLink;
            if (lm && onWikiLink) {
              const linkStart = clickLine.from + lm.index!;
              const linkEnd = linkStart + lm[1].length;
              if (pos >= linkStart && pos <= linkEnd) {
                event.preventDefault();
                onWikiLink(lm[2]);
                return true;
              }
            }
          }

          // Tag click: #tag
          const onTag = callbacksRef.current.onClickTag;
          if (!isOnEditLine && onTag) {
            const tm = clickLine.text.match(/(?:^|\s)(#[A-Za-z0-9_\u{4e00}-\u{9fff}]+)/u);
            if (tm) {
              const tagStart = clickLine.from + tm.index! + tm[0].indexOf("#");
              const tagEnd = tagStart + tm[1].length;
              if (pos >= tagStart && pos <= tagEnd) {
                event.preventDefault();
                onTag(tm[1].slice(1));
                return true;
              }
            }
          }

          // URL click
          if (!isOnEditLine) {
            const urlMatch = clickLine.text.match(/(https?:\/\/[^\s)\]]+)/);
            if (urlMatch) {
              const urlStart = clickLine.from + urlMatch.index!;
              const urlEnd = urlStart + urlMatch[1].length;
              if (pos >= urlStart && pos <= urlEnd) {
                event.preventDefault();
                window.open(urlMatch[1], "_blank", "noopener,noreferrer");
                return true;
              }
            }
          }
          return false;
        },
        paste: (event: ClipboardEvent, view: EditorView) => {
          const items = event.clipboardData?.items;
          if (items && callbacksRef.current.onPasteImage) for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith("image/")) {
              event.preventDefault(); const blob = items[i].getAsFile();
              if (blob) {
                const r = new FileReader();
                r.onload = async () => {
                  const p = await callbacksRef.current.onPasteImage?.(r.result as string);
                  if (p) view.dispatch({ changes: { from: view.state.selection.main.head, insert: "![](" + p + ")\n" } });
                };
                r.readAsDataURL(blob);
              }
              return true;
            }
          }
          const pastedText = event.clipboardData?.getData("text/plain")?.trim();
          const selection = view.state.selection.main;
          if (pastedText && /^https?:\/\/\S+$/i.test(pastedText) && !selection.empty) {
            const selectedText = view.state.doc.sliceString(selection.from, selection.to);
            if (selectedText && !/^\s*$/.test(selectedText)) {
              event.preventDefault();
              view.dispatch({
                changes: { from: selection.from, to: selection.to, insert: `[${selectedText}](${pastedText})` },
              });
              return true;
            }
          }
          return false;
        },
      }),
    ];
    exts.push(keymap.of([{
      key: "Mod-s",
      run: () => {
        void callbacksRef.current.onSave?.();
        return true;
      },
      preventDefault: true,
    }]));

    const view = new EditorView({
      state: EditorState.create({ doc: contentRef.current, extensions: exts }),
      parent: ref.current,
    });
    viewRef.current = view;

    // Obsidian-style focus/blur: when editor gets focus, the cursor line
    // shows raw markdown; when editor loses focus, all lines render clean.
    const handleFocusIn = () => {
      setEditorFocused(true);
      const v = viewRef.current;
      if (v) v.dispatch({ effects: focusEffect.of(true) });
    };
    const handleFocusOut = (e: FocusEvent) => {
      // Only blur if focus actually left the entire editor
      if (view.dom.contains(e.relatedTarget as Node)) return;
      setEditorFocused(false);
      const v = viewRef.current;
      if (v) v.dispatch({ effects: focusEffect.of(false) });
    };

    view.contentDOM.addEventListener("focus", handleFocusIn);
    view.contentDOM.addEventListener("blur", handleFocusOut);
    view.dom.addEventListener("focusout", handleFocusOut);
    view.dom.addEventListener("focusin", handleFocusIn);

    // Register scrollToHeading for TOC navigation
    if (onScrollToHeading) {
      const scrollToHeading = (text: string) => {
        const v = viewRef.current;
        if (!v) return;

        const scrollTo = (pos: number) => {
          v.dispatch({
            effects: EditorView.scrollIntoView(pos, { y: "start", yMargin: 24 }),
            selection: { anchor: pos },
          });
        };

        const doc = v.state.doc;
        // First pass: exact match heading text
        for (let i = 1; i <= doc.lines; i++) {
          const line = doc.line(i);
          const m = line.text.match(/^#{1,6}\s+(.+)$/);
          if (m && m[1].trim() === text) { scrollTo(line.from); return; }
        }
        // Second pass: substring match
        for (let i = 1; i <= doc.lines; i++) {
          const line = doc.line(i);
          const m = line.text.match(/^#{1,6}\s+(.+)$/);
          if (m && m[1].trim().includes(text)) { scrollTo(line.from); return; }
        }
        // Third pass: full-text search in any heading
        for (let i = 1; i <= doc.lines; i++) {
          const line = doc.line(i);
          if (/^#{1,6}\s/.test(line.text) && line.text.includes(text)) { scrollTo(line.from); return; }
        }
      };
      _scrollToHeading = scrollToHeading;
      onScrollToHeading(scrollToHeading);
    }

        return () => {
      _scrollToHeading = null;
      view.contentDOM.removeEventListener("focus", handleFocusIn);
      view.contentDOM.removeEventListener("blur", handleFocusOut);
      view.dom.removeEventListener("focusout", handleFocusOut);
      view.dom.removeEventListener("focusin", handleFocusIn);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // External content sync (deferred to avoid CodeMirror tile corruption)
  useEffect(() => {
    const v = viewRef.current; if (!v) return;

    // Skip if we are currently handling a user-initiated change
    if (syncingRef.current) return;

    const cur = v.state.doc.toString();
    if (cur !== content) {
      syncingRef.current = true;
      // Defer to a macrotask to avoid race with click/selection dispatches.
      setTimeout(() => {
        const v2 = viewRef.current;
        if (!v2) { syncingRef.current = false; return; }
        const cur2 = v2.state.doc.toString();
        const latest = contentRef.current;
        if (cur2 !== latest) {
          try {
            v2.dispatch({
              changes: { from: 0, to: cur2.length, insert: latest },
              selection: { anchor: 0 },
              annotations: Transaction.addToHistory.of(false),
            });
          } catch { /* view might be mid-update */ }
        }
        syncingRef.current = false;
      }, 0);
    }
  }, [content]);

  useEffect(() => {
    if (!revealLineRequest) return;
    const id = window.setTimeout(() => {
      const v = viewRef.current;
      if (!v) return;
      const lineNumber = Math.max(1, Math.min(revealLineRequest.line, v.state.doc.lines));
      const line = v.state.doc.line(lineNumber);
      v.focus();
      v.dispatch({
        selection: { anchor: line.from },
        effects: EditorView.scrollIntoView(line.from, { y: "center", yMargin: 80 }),
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [revealLineRequest?.nonce, revealLineRequest?.line]);

  useEffect(() => {
    if (!insertTextRequest) return;
    const v = viewRef.current;
    if (!v) return;
    const sel = v.state.selection.main;
    v.dispatch({
      changes: { from: sel.from, to: sel.to, insert: insertTextRequest.text },
      selection: { anchor: sel.from + insertTextRequest.text.length },
    });
    v.focus();
  }, [insertTextRequest?.nonce, insertTextRequest?.text]);

    // Use CSS custom property for content width (avoids CodeMirror DOM observer conflicts)
  useEffect(() => {
    const el = ref.current;
    if (el) el.style.setProperty("--editor-content-width", contentWidth + "px");
  }, [contentWidth]);

    useEffect(() => {
    const el = ref.current;
    if (el) el.style.setProperty("--editor-font-size", contentFontSize + "px");
  }, [contentFontSize]);

  return <div ref={ref} style={{ height: "100%", overflow: "hidden" }} />;
}

// ── Keyboard shortcut helpers ────────────────────────────────
function wrapInline(marker: string) {
  return (view: EditorView): boolean => {
    const { state } = view;
    const sel = state.selection.main;
    const text = state.doc.sliceString(sel.from, sel.to);
    if (text) {
      const hasMarker = marker && text.startsWith(marker) && text.endsWith(marker);
      const insert = hasMarker ? text.slice(marker.length, text.length - marker.length) : marker + text + marker;
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert },
        selection: { anchor: sel.from, head: sel.from + insert.length },
      });
    } else {
      const insert = marker + marker;
      const cursorAt = sel.from + marker.length;
      view.dispatch({
        changes: { from: sel.from, insert },
        selection: { anchor: cursorAt, head: cursorAt },
      });
    }
    return true;
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function wrapMarkdownLink(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  const text = state.doc.sliceString(sel.from, sel.to);
  const insert = text ? `[${text}]()` : `[]()`;
  const cursor = text ? sel.from + insert.length - 1 : sel.from + 1;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert },
    selection: { anchor: cursor },
  });
  return true;
}

const PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  "\"": "\"",
  "'": "'",
  "`": "`",
};

const CLOSERS = new Set(Object.values(PAIRS));

function handlePairTyping(event: KeyboardEvent, view: EditorView): boolean {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return false;
  const key = event.key;
  if (key.length !== 1) return false;
  const { state } = view;
  const sel = state.selection.main;

  if (!sel.empty && (PAIRS[key] || key === "*")) {
    const marker = key === "*" ? "*" : key;
    const close = key === "*" ? "*" : PAIRS[key];
    const text = state.doc.sliceString(sel.from, sel.to);
    event.preventDefault();
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: marker + text + close },
      selection: { anchor: sel.from + marker.length, head: sel.to + marker.length },
    });
    return true;
  }

  if (PAIRS[key]) {
    event.preventDefault();
    const close = PAIRS[key];
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: key + close },
      selection: { anchor: sel.from + key.length },
    });
    return true;
  }

  if (CLOSERS.has(key)) {
    const next = state.doc.sliceString(sel.from, sel.from + 1);
    if (sel.empty && next === key) {
      event.preventDefault();
      view.dispatch({ selection: { anchor: sel.from + 1 } });
      return true;
    }
  }

  return false;
}

function toggleTaskLine(view: EditorView): boolean {
  const { state } = view;
  const pos = state.selection.main.head;
  const line = state.doc.lineAt(pos);
  const task = line.text.match(/^(\s*[-*+]\s+\[)([ xX])(\]\s+)/);
  if (task) {
    const markFrom = line.from + task[1].length;
    view.dispatch({
      changes: { from: markFrom, to: markFrom + 1, insert: task[2].toLowerCase() === "x" ? " " : "x" },
    });
    return true;
  }

  const list = line.text.match(/^(\s*[-*+]\s+)(.*)$/);
  if (list) {
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: `${list[1]}[ ] ${list[2]}` },
      selection: { anchor: Math.min(line.to + 4, state.selection.main.head + 4) },
    });
    return true;
  }

  const indent = line.text.match(/^\s*/)?.[0] ?? "";
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: `${indent}- [ ] ${line.text.slice(indent.length)}` },
    selection: { anchor: state.selection.main.head + 6 },
  });
  return true;
}

function continueMarkdownList(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false;

  const line = state.doc.lineAt(sel.from);
  const beforeCursor = line.text.slice(0, sel.from - line.from);
  const unordered = beforeCursor.match(/^(\s*)([-*+])\s+(\[[ xX]\]\s+)?/);
  const ordered = beforeCursor.match(/^(\s*)(\d+)([.)])\s+/);
  if (!unordered && !ordered) return false;

  const markerText = unordered?.[0] ?? ordered?.[0] ?? "";
  const hasOnlyMarker = line.text.slice(markerText.length).trim() === "";
  if (hasOnlyMarker) {
    const indent = unordered?.[1] ?? ordered?.[1] ?? "";
    view.dispatch({
      changes: { from: line.from + indent.length, to: line.to, insert: "" },
      selection: { anchor: line.from + indent.length },
    });
    return true;
  }

  const insert = unordered
    ? `\n${unordered[1]}${unordered[2]} ${unordered[3] ? "[ ] " : ""}`
    : `\n${ordered![1]}${Number(ordered![2]) + 1}${ordered![3]} `;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert },
    selection: { anchor: sel.from + insert.length },
  });
  return true;
}

function indentMarkdownList(view: EditorView): boolean {
  return changeMarkdownListIndent(view, "indent");
}

function outdentMarkdownList(view: EditorView): boolean {
  return changeMarkdownListIndent(view, "outdent");
}

function changeMarkdownListIndent(view: EditorView, direction: "indent" | "outdent"): boolean {
  const { state } = view;
  const sel = state.selection.main;
  const startLine = state.doc.lineAt(sel.from);
  const endLine = state.doc.lineAt(sel.to);
  const changes: { from: number; to?: number; insert: string }[] = [];

  for (let lineNumber = startLine.number; lineNumber <= endLine.number; lineNumber++) {
    const line = state.doc.line(lineNumber);
    if (!/^(\s*)(?:[-*+]\s+|\d+[.)]\s+)/.test(line.text)) continue;
    if (direction === "indent") {
      changes.push({ from: line.from, insert: "  " });
      continue;
    }
    if (line.text.startsWith("  ")) {
      changes.push({ from: line.from, to: line.from + 2, insert: "" });
    } else if (line.text.startsWith("\t")) {
      changes.push({ from: line.from, to: line.from + 1, insert: "" });
    }
  }

  if (changes.length === 0) return false;
  view.dispatch({ changes });
  return true;
}
