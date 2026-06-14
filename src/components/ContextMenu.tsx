import { Copy, FilePlus, FolderOpen, FolderPlus, Link2, Pencil, Star, Trash2 } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useVaultContext } from "../contexts/VaultContext";
import { appInvoke } from "../bridge";
import { titleFromPath } from "../utils/helpers";

export function ContextMenu() {
  const app = useAppContext();
  const vault = useVaultContext();

  const handleOpenInExplorer = async (entryPath: string, isDir: boolean) => {
    const basePath = (app.activeVault + "\\" + entryPath).replace(/\//g, "\\");
    const targetPath = isDir ? basePath : basePath.substring(0, basePath.lastIndexOf("\\"));
    try {
      await appInvoke("open_in_explorer", { path: targetPath });
    } catch { /* fallback: try opener plugin */ }
  };

  const handleNewFolder = async (parentPath: string) => {
    try {
      await appInvoke("create_folder", { root: app.activeVault, dir: parentPath, title: "New Folder" });
      await vault.refreshEntries(app.activeVault);
    } catch (e) { console.error("new_folder/note failed:", e); }
  };

  const handleNewNote = async (parentPath: string) => {
    try {
      await appInvoke("create_note_in_dir", { root: app.activeVault, dir: parentPath, title: app.t.untitled });
      await vault.refreshEntries(app.activeVault);
    } catch (e) { console.error("new_folder/note failed:", e); }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
  };

  return (
    <>
      {vault.contextMenu && (
        <div className="context-menu-shield" data-custom-contextmenu="true" onMouseDown={() => vault.setContextMenu(null)}>
          <div data-custom-contextmenu="true" className="file-context-menu"
            style={{ left: vault.contextMenu.x, top: vault.contextMenu.y }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {vault.contextMenu.entry.isDir && (
              <>
                <button onClick={() => { handleNewFolder(vault.contextMenu!.entry.path); vault.setContextMenu(null); }}>
                  <FolderPlus size={16} />
                  <span>{app.t.newFolder}</span>
                </button>
                <button onClick={() => { handleNewNote(vault.contextMenu!.entry.path); vault.setContextMenu(null); }}>
                  <FilePlus size={16} />
                  <span>{app.t.newNoteInFolder}</span>
                </button>
              </>
            )}
            <button onClick={() => { app.toggleBookmark(vault.contextMenu!.entry.path); vault.setContextMenu(null); }}>
              <Star size={16} />
              <span>{app.bookmarks.includes(vault.contextMenu.entry.path) ? app.t.removeBookmark : app.t.addBookmark}</span>
            </button>
            {!vault.contextMenu.entry.isDir && (
              <button onClick={() => { void copyText(`[[${titleFromPath(vault.contextMenu!.entry.path)}]]`); vault.setContextMenu(null); }}>
                <Link2 size={16} />
                <span>{app.t.copyLink}</span>
              </button>
            )}
            <button onClick={() => { void copyText(vault.contextMenu!.entry.path); vault.setContextMenu(null); }}>
              <Copy size={16} />
              <span>{app.t.copyPath}</span>
            </button>
            <button onClick={() => { vault.setRenamingEntry(vault.contextMenu!.entry); vault.setContextMenu(null); }}>
              <Pencil size={16} />
              <span>{app.t.rename}</span>
            </button>
            <button onClick={() => { handleOpenInExplorer(vault.contextMenu!.entry.path, vault.contextMenu!.entry.isDir); vault.setContextMenu(null); }}>
              <FolderOpen size={16} />
              <span>{app.t.openInSystem}</span>
            </button>
            <button className="danger-item" onClick={() => { vault.setDeleteTarget(vault.contextMenu!.entry); vault.setContextMenu(null); }}>
              <Trash2 size={16} />
              <span>{app.t.delete}</span>
            </button>
          </div>
        </div>
      )}

      {vault.deleteTarget && (
        <div className="confirm-backdrop" onMouseDown={() => vault.setDeleteTarget(null)}>
          <section className="confirm-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <div className="confirm-icon"><Trash2 size={20} /></div>
            <div className="confirm-copy">
              <h2>{app.t.delete}</h2>
              <p>{app.t.deleteConfirm}</p>
              <code>{vault.deleteTarget.path}</code>
            </div>
            <div className="confirm-actions">
              <button className="secondary-action" onClick={() => vault.setDeleteTarget(null)}>{app.t.cancel}</button>
              <button className="danger-action" onClick={() => {
                void vault.deleteEntry(vault.deleteTarget!);
                vault.setDeleteTarget(null);
              }}>{app.t.delete}</button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
