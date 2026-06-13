import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { FolderOpen, Vault } from "lucide-react";
import { ToastProvider } from "./components/Toast";
import { AppProvider, useAppContext } from "./contexts/AppContext";
import { VaultProvider, useVaultContext } from "./contexts/VaultContext";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { Ribbon } from "./components/Ribbon";
import { FileSidebar } from "./components/FileSidebar";
import { MarkdownLiveEditor } from "./components/MarkdownLiveEditor";
import { TaskPanel } from "./components/TaskPanel";
import { GraphPanel } from "./components/GraphPanel";
import { ContextSidebar } from "./components/ContextSidebar";
import { ContextMenu } from "./components/ContextMenu";
import { appInvoke } from "./bridge";
import "./App.css";

const CommandPalette = lazy(() => import("./components/CommandPalette").then(m => ({ default: m.CommandPalette })));
const SettingsPanel = lazy(() => import("./components/SettingsPanel").then(m => ({ default: m.SettingsPanel })));

const isDesktop = isTauri();

function AppInner() {
  const app = useAppContext();
  const vault = useVaultContext();
  const [creating, setCreating] = useState(false);

  // ── ALL hooks must be here, before any conditional returns ──
  const handlePickVault = useCallback(async () => {
    setCreating(true);
    try {
      const path = await app.chooseVaultFolder();
      if (path) {
        const name = path.split(/[/\\]/).pop() || path;
        app.addVault(name, path);
        app.setActiveVault(path);
      }
    } catch { /* user cancelled */ }
    setCreating(false);
  }, [app]);

  useEffect(() => {
    const id = "custom-theme-css";
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (app.themeFile) {
      if (!link) {
        link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        document.head.appendChild(link);
      }
      link.href = `/themes/${app.themeFile}`;
    } else {
      if (link) link.remove();
    }
  }, [app.themeFile]);

  useEffect(() => {
    if (app.settingsLoaded && app.activeVault) {
      void vault.activateVault(app.activeVault);
    }
  }, [app.settingsLoaded, app.activeVault]);

  useEffect(() => {
    if (vault.entries.length === 0) return;
    const dirPaths = vault.entries.filter((e) => e.isDir).map((e) => e.path);
    if (dirPaths.length === 0) return;

    // First launch: collapse all directories
    if (!app.vaultInitialized) {
      app.setCollapsedDirs(new Set(dirPaths));
      app.setVaultInitialized(true);
      return;
    }

    // Subsequent: only collapse truly new directories
    const next = new Set(app.collapsedDirs);
    let changed = false;
    for (const dir of dirPaths) {
      if (!next.has(dir)) { next.add(dir); changed = true; }
    }
    if (changed) app.setCollapsedDirs(next);
  }, [app.vaultInitialized, vault.entries]);

  useKeyboardShortcuts({
    enableKeyboardShortcuts: app.enableKeyboardShortcuts,
    saveCurrent: vault.saveCurrent,
    createNote: vault.createNote,
    openPalette: () => vault.setIsPaletteOpen(true),
    closeCurrentTab: () => {
      if (vault.selectedPath) void vault.closeTab(vault.selectedPath);
    },
    shortcutSave: app.shortcutSave,
    shortcutPalette: app.shortcutPalette,
    shortcutNewNote: app.shortcutNewNote,
    shortcutCloseTab: app.shortcutCloseTab,
  });

  // ── Drag & drop: drop a folder to add as vault ──
  useEffect(() => {
    if (!isDesktop) return;
    const unlisten = getCurrentWindow().onDragDropEvent((event) => {
      if (event.payload.type === "drop") {
        for (const path of event.payload.paths) {
          void (async () => {
            try {
              const isDir = await appInvoke<boolean>("check_is_dir", { path });
              if (isDir) {
                const name = path.split(/[/\\]/).pop() || path;
                app.addVault(name, path);
                app.setActiveVault(path);
              }
            } catch { /* not a valid path */ }
          })();
          break; // Only process first dropped item
        }
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [app]);

  // ── Conditional rendering ──

  if (!app.settingsLoaded) {
    return (
      <ToastProvider position={app.toastPosition}>
        <main className={`obsidian-shell theme-${app.theme}`} lang={app.language}>
          <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <span style={{ color: "var(--nord3)", fontSize: 14 }}>{app.t.welcomeStatus}</span>
          </div>
        </main>
      </ToastProvider>
    );
  }

  if (!app.activeVault) {
    return (
      <ToastProvider position={app.toastPosition}>
        <main className={`obsidian-shell theme-${app.theme}`} lang={app.language}>
          <div style={{ gridColumn: "1 / -1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16 }}>
            <Vault size={48} style={{ color: "var(--nord3)", opacity: 0.5 }} />
            <h2 style={{ color: "var(--nord4)", margin: 0, fontSize: 20, fontWeight: 500 }}>{app.t.welcomeNoVault}</h2>
            <button
              onClick={handlePickVault}
              disabled={creating}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 24px", borderRadius: 8,
                border: "1px solid rgba(136,192,208,0.4)",
                background: "rgba(136,192,208,0.12)",
                color: "var(--nord8)", cursor: "pointer",
                fontSize: 14, fontWeight: 600,
              }}
            >
              <FolderOpen size={18} />
              {creating ? app.t.creatingVault : app.t.selectVault}
            </button>
            {app.vaults.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ color: "var(--nord3)", fontSize: 12 }}>最近使用：</span>
                {app.vaults.map(v => (
                  <button key={v.path} onClick={() => app.setActiveVault(v.path)}
                    style={{ background: "transparent", border: "none", color: "var(--nord4)", cursor: "pointer", fontSize: 13, padding: "4px 8px", borderRadius: 4 }}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider position={app.toastPosition}>
    <main
      className={`obsidian-shell theme-${app.theme} ${app.sidebarCollapsed ? "ribbon-collapsed" : "ribbon-expanded"}`}
      lang={app.language}
      style={{
        "--ui-font": app.uiFont,
        "--code-font": app.codeFont,
        fontFamily: `var(--ui-font)`,
        fontSize: `${app.uiFontSize}px`,
      } as React.CSSProperties}
    >
      <Ribbon />
      <FileSidebar />
      {vault.isGraphOpen ? <GraphPanel /> : vault.isTasksOpen ? <TaskPanel /> : <MarkdownLiveEditor />}
      <ContextSidebar />

      {vault.isPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      )}
      <ContextMenu />

      {vault.isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsPanel />
        </Suspense>
      )}
    </main>
    </ToastProvider>
  );
}

function App() {
  return (
    <AppProvider>
      <VaultProvider>
        <AppInner />
      </VaultProvider>
    </AppProvider>
  );
}

export default App;
