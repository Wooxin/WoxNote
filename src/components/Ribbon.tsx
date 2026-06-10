import { useRef, useState } from "react";
import { BookOpen, Columns2, Command, Languages, Moon, Plus, RefreshCw, Settings, Sun, Vault } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useVaultContext } from "../contexts/VaultContext";

export function Ribbon() {
  const app = useAppContext();
  const vault = useVaultContext();
  const [vaultMenuOpen, setVaultMenuOpen] = useState(false);
  const vaultBtnRef = useRef<HTMLButtonElement>(null);

  const activeVaultName = app.vaults.find((v) => v.path === app.activeVault)?.name || app.t.vault;

  return (
    <aside className="ribbon">
      <button className="ribbon-button" title={app.sidebarCollapsed ? app.t.expandSidebar : app.t.collapseSidebar} onClick={() => app.setSidebarCollapsed((c) => !c)}>
        <Columns2 size={20} />
        <span>{app.sidebarCollapsed ? app.t.expandSidebar : app.t.collapseSidebar}</span>
      </button>
      <button className="ribbon-button active" title={app.t.fileTree}><BookOpen size={20} /><span>{app.t.fileTree}</span></button>
      {app.activeVault && (
        <>
          <button className="ribbon-button" title={app.t.quickOpen} onClick={() => vault.setIsPaletteOpen(true)}><Command size={20} /><span>{app.t.quickOpen}</span></button>
          <button className="ribbon-button" title={app.t.newNote} onClick={() => void vault.createNote()}><Plus size={20} /><span>{app.t.newNote}</span></button>
          <button className="ribbon-button" title={app.t.refreshVault} onClick={() => void vault.refreshEntries(app.activeVault)}><RefreshCw size={20} /><span>{app.t.refreshVault}</span></button>
        </>
      )}

      {/* Vault switcher — single button + dropdown */}
      <button ref={vaultBtnRef} className="ribbon-button" title={app.t.vault}
        onClick={() => setVaultMenuOpen((v) => !v)}>
        <Vault size={18} />
        <span>{activeVaultName}</span>
      </button>

      {vaultMenuOpen && (
        <div className="vault-switcher-dropdown" style={{
          position: "fixed",
          left: (vaultBtnRef.current?.getBoundingClientRect().right ?? 48) + 4,
          top: vaultBtnRef.current?.getBoundingClientRect().bottom ?? 0,
          zIndex: 50,
        }}>
          {app.vaults.map((v) => (
            <button key={v.path} className={`vault-switcher-item ${v.path === app.activeVault ? "active" : ""}`}
              onClick={() => { app.setActiveVault(v.path); void vault.activateVault(v.path); setVaultMenuOpen(false); }}>
              <Vault size={14} />
              <span>{v.name}</span>
              {v.path === app.activeVault && <span className="vault-switcher-check">&#x2713;</span>}
            </button>
          ))}
        </div>
      )}

      {/* Close dropdown on outside click */}
      {vaultMenuOpen && <div className="context-menu-shield" style={{ zIndex: 49 }} onMouseDown={() => setVaultMenuOpen(false)} />}

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