import { useCallback, useEffect, useRef, useState } from "react";
import { Columns3, FileCode, Minus, Table, X } from "lucide-react";
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

export function MarkdownLiveEditor() {
  const app = useAppContext();
  const vault = useVaultContext();
  const [editorMenu, setEditorMenu] = useState<{ x: number; y: number } | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const scrollToHeadingRef = useRef<((text: string) => void) | null>(null);
  const [cursorLine, setCursorLine] = useState(1);
  const [cursorCol, setCursorCol] = useState(1);

  useEffect(() => {
    vault.setScrollToHeading(scrollToHeadingRef.current);
  }, []);

  const [titleValue, setTitleValue] = useState("");

  const wordCount = (vault.content || "").match(/[\u4e00-\u9fff]|[a-zA-Z0-9]+/g)?.length ?? 0;
  const charCount = (vault.content || "").replace(/\s/g, "").length;

  const insertAtEnd = useCallback((template: string) => {
    vault.handleContentChange(vault.content ? vault.content + "\n\n" + template : template);
  }, [vault]);

  const handlePasteImage = useCallback(async (dataUrl: string): Promise<string | null> => {
    try {
      return await appInvoke<string>("paste_image", { root: app.vaultPath, dataUrl });
    } catch { return null; }
  }, [app.vaultPath]);

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
    { icon: <Table size={15} />, label: app.t.insertTable, action: () => insertAtEnd(TABLE_TEMPLATE) },
    { icon: <FileCode size={15} />, label: app.t.insertCodeBlock, action: () => insertAtEnd(CODE_TEMPLATE) },
    { icon: <Columns3 size={15} />, label: app.t.insertCallout, action: () => insertAtEnd(CALLOUT_TEMPLATE) },
    { icon: <Minus size={15} />, label: app.t.insertDivider, action: () => insertAtEnd("---") },
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
            vaultPath={app.vaultPath}
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
        <div className="context-menu-shield" onMouseDown={() => setEditorMenu(null)}>
          <div className="file-context-menu editor-insert-menu" style={{ left: editorMenu.x, top: editorMenu.y }} onMouseDown={(e) => e.stopPropagation()}>
            {menuItems.map((item) => (
              <button key={item.label} onClick={() => { item.action(); setEditorMenu(null); }}>{item.icon}<span>{item.label}</span></button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
