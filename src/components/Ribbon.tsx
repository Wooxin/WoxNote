import { BookOpen, Columns2, Command, Languages, Moon, Plus, RefreshCw, Settings, Sun } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useVaultContext } from "../contexts/VaultContext";

export function Ribbon() {
  const app = useAppContext();
  const vault = useVaultContext();

  return (
    <aside className="ribbon">
      <button className="ribbon-button" title={app.sidebarCollapsed ? app.t.expandSidebar : app.t.collapseSidebar} onClick={() => app.setSidebarCollapsed((c) => !c)}>
        <Columns2 size={20} />
        <span>{app.sidebarCollapsed ? app.t.expandSidebar : app.t.collapseSidebar}</span>
      </button>
      <button className="ribbon-button active" title={app.t.fileTree}><BookOpen size={20} /><span>{app.t.fileTree}</span></button>
      <button className="ribbon-button" title={app.t.quickOpen} onClick={() => vault.setIsPaletteOpen(true)}><Command size={20} /><span>{app.t.quickOpen}</span></button>
      <button className="ribbon-button" title={app.t.newNote} onClick={() => void vault.createNote()}><Plus size={20} /><span>{app.t.newNote}</span></button>
      <button className="ribbon-button" title={app.t.refreshVault} onClick={() => void vault.refreshEntries(app.vaultPath)}><RefreshCw size={20} /><span>{app.t.refreshVault}</span></button>
      {app.showQuickSettings && (
        <>
          <button className="ribbon-button" title={app.t.theme} onClick={() => app.setTheme((c) => c === "dark" ? "light" : "dark")}>
            {app.theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            <span>{app.t.theme}</span>
          </button>
          <button className="ribbon-button" title={app.t.language} onClick={() => app.setLanguage((c) => c === "zh" ? "en" : "zh")}><Languages size={20} /><span>{app.t.language}</span></button>
        </>
      )}
      <button className="ribbon-button bottom" title={app.t.settings} onClick={() => vault.setIsSettingsOpen(true)}><Settings size={20} /><span>{app.t.settings}</span></button>
    </aside>
  );
}