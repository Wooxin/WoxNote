import { Suspense, lazy, useEffect } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { openPath } from "@tauri-apps/plugin-opener";
import { ToastProvider } from "./components/Toast";
import { AppProvider, useAppContext } from "./contexts/AppContext";
import { VaultProvider, useVaultContext } from "./contexts/VaultContext";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { Ribbon } from "./components/Ribbon";
import { FileSidebar } from "./components/FileSidebar";
import { MarkdownLiveEditor } from "./components/MarkdownLiveEditor";
import { ContextSidebar } from "./components/ContextSidebar";
import { ContextMenu } from "./components/ContextMenu";
import "./App.css";

const CommandPalette = lazy(() => import("./components/CommandPalette").then(m => ({ default: m.CommandPalette })));
const SettingsPanel = lazy(() => import("./components/SettingsPanel").then(m => ({ default: m.SettingsPanel })));

const isDesktop = isTauri();

function AppInner() {
  const app = useAppContext();
  const vault = useVaultContext();

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
    if (app.settingsLoaded && app.vaultPath) {
      vault.activateVault(app.vaultPath).then((entries) => {
        // Restore last opened note using the fresh entries list
        if (app.lastOpenedPath && entries) {
          const entry = entries.find((e) => e.path === app.lastOpenedPath);
          if (entry) void vault.handleSelectFile(entry);
        }
      });
    }
  }, [app.settingsLoaded, app.vaultPath]);

  useEffect(() => {
    if (vault.entries.length === 0) return;
    const dirPaths = vault.entries.filter((e) => e.isDir).map((e) => e.path);
    if (dirPaths.length === 0) return;

    if (!app.vaultInitialized) {
      // First launch: collapse all directories
      app.setCollapsedDirs(new Set(dirPaths));
      app.setVaultInitialized(true);
    } else {
      // Subsequent launches / refreshes: collapse only NEW directories
      // (don't touch directories the user has already expanded)
      const next = new Set(app.collapsedDirs);
      let changed = false;
      for (const dir of dirPaths) {
        if (!next.has(dir)) { next.add(dir); changed = true; }
      }
      if (changed) app.setCollapsedDirs(next);
    }
  }, [app.vaultInitialized, vault.entries]);

  // Persist last opened note
  useEffect(() => {
    if (vault.selectedPath && vault.selectedPath !== app.lastOpenedPath) {
      app.setLastOpenedPath(vault.selectedPath);
    }
  }, [vault.selectedPath]);

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

  const handleChooseVault = async () => {
    const selected = await app.chooseVaultFolder();
    if (selected) {
      app.setVaultPath(selected);
      await vault.activateVault(selected);
    }
  };

  const handleOpenInSystem = (path: string) => {
    if (isDesktop) void openPath(path);
  };

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
      <MarkdownLiveEditor />
      <ContextSidebar onOpenInSystem={handleOpenInSystem} />

      {vault.isPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette />
        </Suspense>
      )}
      <ContextMenu />

      {vault.isSettingsOpen && (
        <Suspense fallback={null}>
          <SettingsPanel
            onActivateVault={(path) => void vault.activateVault(path)}
            onChooseVault={() => void handleChooseVault()}
          />
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
