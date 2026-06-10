import { useEffect, useRef } from "react";
import { EditorView, keymap, highlightActiveLine, ViewUpdate, drawSelection } from "@codemirror/view";
import { EditorState, type Extension } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, syntaxTree } from "@codemirror/language";

// Module-level scroll-to-heading — accessible from any component
let _scrollToHeading: ((text: string) => void) | null = null;
export function scrollToHeading(text: string) { _scrollToHeading?.(text); }
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";
import { closeBrackets, autocompletion } from "@codemirror/autocomplete";
import type { CompletionContext } from "@codemirror/autocomplete";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";

import { STYLE_ID, CSS, woxHighlightStyle } from "./styles";
import { setEditorFocused, isEditorFocused, focusEffect, previewField, setVaultPath, childrenOf } from "./decorations";
import { cmTheme, darkTheme } from "./theme";
import { appInvoke } from "../../bridge";

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
  vaultPath?: string;
};


export function CMLivePreview({
  content, contentWidth, contentFontSize, noteTitles,
  onContentChange, onPasteImage, onSave, onClickWikiLink, onClickTag,
  onScrollToHeading, onCursorChange, vaultPath,
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
      if (!typed.trim()) return null;

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
        .filter((t) => t.toLowerCase().includes(q))
        .slice(0, 20)
        .map((t) => ({ label: t, type: "text" as const, apply: t + "]]", detail: "note" }));
      return matches.length ? { from: word.from + 2, options: matches, filter: false } : null;
    };

    const markdownKeymap = keymap.of([
      { key: "Mod-b", run: wrapInline("**") },
      { key: "Mod-i", run: wrapInline("*") },
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
            });
          } catch { /* view might be mid-update */ }
        }
        syncingRef.current = false;
      }, 0);
    }
  }, [content]);

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
      const insert = marker + text + marker;
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
