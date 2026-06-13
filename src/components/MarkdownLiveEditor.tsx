import { useCallback, useEffect, useRef, useState } from "react";
import { Columns3, Copy, FileCode, Minus, Paintbrush, Scissors, Table, X, ClipboardPaste } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useVaultContext } from "../contexts/VaultContext";
import { BinaryPreview } from "./BinaryPreview";
import { CMLivePreview } from "./CMLivePreview";
import { StatusBar } from "./StatusBar";
import { appInvoke } from "../bridge";

const TABLE_TEMPLATE = `| H1 | H2 | H3 |
| -- | -- | -- |
|    |    |    |
|    |    |    |`;

const CODE_TEMPLATE = "````\ncode here\n````";

const CALLOUT_TEMPLATE = `> **Note**
> Callout content`;

const PRESET_COLORS = [
  { label: "Red", color: "#e53935" },
  { label: "Orange", color: "#fb8c00" },
  { label: "Green", color: "#43a047" },
  { label: "Blue", color: "#1e88e5" },
  { label: "Purple", color: "#8e24aa" },
  { label: "Gray", color: "#757575" },
];

export function MarkdownLiveEditor() {
  const app = useAppContext();
  const vault = useVaultContext();
  const [editorMenu, setEditorMenu] = useState<{ x: number; y: number } | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const scrollToHeadingRef = useRef<((text: string) => void) | null>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);

  useEffect(() => {
    vault.setScrollToHeading(scrollToHeadingRef.current);
  }, []);

  const [titleValue, setTitleValue] = useState("");
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    appInvoke<number>("count_words", { content: vault.content || "" })
      .then(n => { if (!cancelled) setWordCount(n); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [vault.content]);

  const charCount = (vault.content || "").replace(/\s/g, "").length;

  const insertAtEnd = useCallback((template: string) => {
    vault.handleContentChange(vault.content ? vault.content + "\n\n" + template : template);
  }, [vault]);

  const getSelectedText = useCallback((): string => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return "";
    return sel.toString();
  }, []);

  const handleCopy = useCallback(async () => {
    const text = getSelectedText();
    if (text) {
      try { await navigator.clipboard.writeText(text); } catch { document.execCommand("copy"); }
    }
    setEditorMenu(null);
  }, [getSelectedText]);

  const handleCut = useCallback(async () => {
    const text = getSelectedText();
    if (text) {
      try { await navigator.clipboard.writeText(text); } catch { document.execCommand("cut"); }
      vault.handleContentChange(vault.content.replace(text, ""));
    }
    setEditorMenu(null);
  }, [getSelectedText, vault]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const sel = getSelectedText();
        if (sel) {
          vault.handleContentChange(vault.content.replace(sel, text));
        } else {
          vault.handleContentChange(vault.content + "\n" + text);
        }
      }
    } catch { /* clipboard read may fail */ }
    setEditorMenu(null);
  }, [getSelectedText, vault]);

  const applyColor = useCallback((color: string) => {
    const sel = getSelectedText();
    if (sel) {
      const wrapped = `<font color="${color}">${sel}</font>`;
      vault.handleContentChange(vault.content.replace(sel, wrapped));
    }
    setEditorMenu(null);
    setShowColorPicker(false);
  }, [getSelectedText, vault]);

  const handlePasteImage = useCallback(async (dataUrl: string): Promise<string | null> => {
    try {
      return await appInvoke<string>("paste_image", { root: app.activeVault, dataUrl });
    } catch { return null; }
  }, [app.activeVault]);

  const handleRenameFile = async (entry: typeof vault.selectedEntry, newName: string) => {
    if (!entry) return;
    try {
      await vault.renameEntry(entry, newName);
    } catch { /* ignore */ }
  };

  const commitTitleRename = () => {
    const nextTitle = titleValue.trim();
    const entry = vault.selectedEntry;
    setEditingTitle(false);
    if (entry && nextTitle && nextTitle !== entry.name) void handleRenameFile(entry, nextTitle);
  };

  const menuItems = [
    { icon: <Copy size={15} />, label: app.t.copy, action: handleCopy },
    { icon: <Scissors size={15} />, label: app.t.cut, action: handleCut },
    { icon: <ClipboardPaste size={15} />, label: app.t.paste, action: handlePaste },
    { icon: <Paintbrush size={15} />, label: app.t.textColor, action: () => setShowColorPicker((v) => !v) },
    { icon: <Table size={15} />, label: app.t.insertTable, action: () => { insertAtEnd(TABLE_TEMPLATE); setEditorMenu(null); } },
    { icon: <FileCode size={15} />, label: app.t.insertCodeBlock, action: () => { insertAtEnd(CODE_TEMPLATE); setEditorMenu(null); } },
    { icon: <Columns3 size={15} />, label: app.t.insertCallout, action: () => { insertAtEnd(CALLOUT_TEMPLATE); setEditorMenu(null); } },
    { icon: <Minus size={15} />, label: app.t.insertDivider, action: () => { insertAtEnd("---"); setEditorMenu(null); } },
  ];

  return (
    <section className="main-pane">
      <div className="tabs-bar">
        {vault.openTabs.length === 0 ? (
          <div className="empty-tab">{app.t.noFileOpen}</div>
        ) : vault.openTabs.map((path) => {
          const entry = vault.entries.find((item) => item.path === path);
          return (
            <button key={path} className={`tab ${path === vault.selectedEntry?.path ? "active" : ""}`}
              onClick={() => entry && void vault.handleSelectFile(entry)}
              onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); void vault.closeTab(path); } }}>
              <span>{entry?.name ?? path}</span>
              <X size={14} onClick={(event) => { event.stopPropagation(); void vault.closeTab(path); }} />
            </button>
          );
        })}
      </div>

      <div className="note-toolbar">
        <div className="note-title">
          {editingTitle && vault.selectedEntry ? (
            <input className="title-input" value={titleValue}
              onChange={(e) => setTitleValue(e.target.value)}
              onBlur={commitTitleRename}
              onKeyDown={(e) => { if (e.key === "Enter") commitTitleRename(); if (e.key === "Escape") setEditingTitle(false); }}
              autoFocus onFocus={(e) => e.target.select()} spellCheck={false} />
          ) : (
            <span onClick={() => { if (vault.selectedEntry && vault.canEdit) { setTitleValue(vault.selectedEntry.name); setEditingTitle(true); } }}
              style={{ cursor: vault.canEdit ? "text" : "default" }}>
              {vault.selectedEntry?.name ?? app.t.untitled}
            </span>
          )}
          {vault.selectedEntry && <small>{vault.selectedEntry.path}</small>}
        </div>
      </div>

      <div className="document-surface live-preview"
        onContextMenu={(e) => { if (vault.preview.type === "markdown" || vault.preview.type === "text" || vault.preview.type === "empty") { e.preventDefault(); setEditorMenu({ x: e.clientX, y: e.clientY }); } }}>
        {!vault.selectedEntry ? (
          <div className="empty-state">{vault.isLoading ? app.t.loadingVault : app.t.openFileHint}</div>
        ) : !vault.canEdit && vault.preview.type !== "empty" ? (
          <BinaryPreview preview={vault.preview} />
        ) : (
          <CMLivePreview
            key={vault.selectedEntry.path}
            content={vault.content}
            contentWidth={app.contentWidth}
            contentFontSize={app.contentFontSize}
            onContentChange={vault.handleContentChange}
            onPasteImage={handlePasteImage}
            onSave={() => void vault.saveCurrent()}
            noteTitles={vault.notes.map(e => e.name.replace(/\.(md|markdown)$/i, ""))}
            onClickWikiLink={(title) => vault.openLinkByTitle(title)} onClickTag={(tag) => vault.setGlobalSearch(tag)}
            onScrollToHeading={(fn) => { scrollToHeadingRef.current = fn; vault.setScrollToHeading(fn); }}
            onCursorChange={(line, col) => { setCursorLine(line); setCursorCol(col); }}
            revealLineRequest={vault.lineRevealRequest}
            vaultPath={app.activeVault}
          />
        )}
      </div>

      {vault.selectedEntry && vault.canEdit && (
        <StatusBar
          wordCount={wordCount}
          charCount={charCount}
          cursorLine={cursorLine}
          cursorCol={cursorCol}
          noteName={vault.selectedEntry.name}
        />
      )}

      {editorMenu && (
        <div className="context-menu-shield" onMouseDown={() => { setEditorMenu(null); setShowColorPicker(false); }}>
          <div className="file-context-menu editor-insert-menu" style={{ left: editorMenu.x, top: editorMenu.y }} onMouseDown={(e) => e.stopPropagation()}>
            {menuItems.map((item) => (
              <button key={item.label} onClick={() => { item.action(); if (item.label !== app.t.textColor) setEditorMenu(null); }}>
                {item.icon}<span>{item.label}</span>
              </button>
            ))}
            {showColorPicker && (
              <div className="color-picker-submenu">
                {PRESET_COLORS.map((c) => (
                  <button key={c.color} onClick={() => applyColor(c.color)}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 8px" }}>
                    <span style={{ width: 16, height: 16, borderRadius: 3, background: c.color, display: "inline-block" }} />
                    <span style={{ fontSize: 12 }}>{c.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
