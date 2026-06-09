import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, File, Plus, Save, Search } from "lucide-react";
import type { NoteEntry } from "../types";
import { useAppContext } from "../contexts/AppContext";
import { useVaultContext } from "../contexts/VaultContext";
import { iconForEntry } from "../utils/helpers";

function renderSnippet(snippet: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let highlighted = false;

  snippet.split(/(<mark>|<\/mark>)/gi).forEach((part, index) => {
    const token = part.toLowerCase();
    if (token === "<mark>") {
      highlighted = true;
      return;
    }
    if (token === "</mark>") {
      highlighted = false;
      return;
    }
    if (!part) return;
    nodes.push(highlighted ? <mark key={index}>{part}</mark> : part);
  });

  return nodes;
}

export function FileSidebar() {
  const app = useAppContext();
  const vault = useVaultContext();
  const [renameValue, setRenameValue] = useState("");
  const renameCommittedRef = useRef(false);

  useEffect(() => {
    if (vault.renamingEntry) {
      setRenameValue(vault.renamingEntry.name);
      renameCommittedRef.current = false;
    }
  }, [vault.renamingEntry]);

  const handleRename = (entry: NoteEntry, newName: string) => {
    if (renameCommittedRef.current) return;
    renameCommittedRef.current = true;
    vault.setRenamingEntry(null);
    void (async () => {
      try {
        await vault.renameEntry(entry, newName);
      } catch (e) { console.error("rename failed:", e); }
    })();
  };

  const commitRename = (entry: NoteEntry) => {
    const nextName = renameValue.trim();
    if (nextName) handleRename(entry, nextName);
    else vault.setRenamingEntry(null);
  };

  return (
    <aside className="file-sidebar">
      <div className="vault-header">
        <div>
          <h1>WoxNote</h1>
          <p>{vault.isDirty ? app.t.unsaved : vault.status}</p>
        </div>
        <button className="icon-button" title={app.t.save} disabled={!vault.isDirty} onClick={() => void vault.saveCurrent()}>
          <Save size={17} />
        </button>
      </div>

      <button className="quick-open" onClick={() => vault.setIsPaletteOpen(true)}>
        <Search size={16} />
        <span>{app.t.quickOpen}</span>
      </button>

      <div className="tree-title">
        <span>{app.t.fileTree}</span>
        <button title={app.t.newNote} onClick={() => void vault.createNote()}><Plus size={16} /></button>
      </div>
      <div className="file-filter">
        <Search size={15} />
        <input value={vault.globalSearch} onChange={(event) => vault.setGlobalSearch(event.currentTarget.value)} placeholder={app.t.searchCurrentVault} />
      </div>
      {vault.ftsResults.length > 0 && (
        <div className="sidebar-search-results">
          {vault.ftsResults.map((result) => (
            <button key={result.path} onClick={() => {
              vault.setGlobalSearch("");
              const entry = vault.entries.find((e) => e.path === result.path);
              if (entry) void vault.handleSelectFile(entry);
            }}>
              <File size={17} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {result.path}
                </div>
                <div
                  style={{ fontSize: 11, color: "#7f8a96", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {renderSnippet(result.snippet)}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="file-tree" aria-label="Files">
        {vault.visibleEntries.map((entry) => {
          const isCollapsed = entry.isDir && app.collapsedDirs.has(entry.path);
          const depth = entry.path.split("/").length - 1;

          return (
            <button
              key={entry.path}
              className={`tree-row ${vault.selectedPath === entry.path ? "active" : ""} ${entry.isDir ? "folder-row" : ""}`}
              style={{ paddingLeft: `${10 + depth * 14}px` }}
              onClick={() => entry.isDir ? vault.toggleDirCollapse(entry.path) : void vault.handleSelectFile(entry)}
              onContextMenu={(event) => {
                event.preventDefault();
                vault.setContextMenu({ x: event.clientX, y: event.clientY, entry });
              }}
            >
              {entry.isDir ? (
                isCollapsed
                  ? <ChevronRight size={14} className="tree-chevron" />
                  : <ChevronDown size={14} className="tree-chevron" />
              ) : (
                <span style={{ width: 14 }} />
              )}
              {iconForEntry(entry)}
              {vault.renamingEntry?.path === entry.path ? (
                <input
                  className="rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(entry)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(entry);
                    if (e.key === "Escape") {
                      renameCommittedRef.current = true;
                      vault.setRenamingEntry(null);
                    }
                  }}
                  onFocus={(e) => e.target.select()}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  spellCheck={false}
                />
              ) : (
                <span>{entry.name}</span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
