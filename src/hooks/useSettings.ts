import { useCallback, useEffect, useRef, useState } from "react";
import type { Language, StartupInfo, ThemeMode, UserSettings } from "../types";
import { appInvoke } from "../bridge";

export function useSettings() {
  const [vaults, setVaultsState] = useState<{ name: string; path: string }[]>([]);
  const [activeVault, setActiveVaultState] = useState("");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [language, setLanguage] = useState<Language>("zh");
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [enableKeyboardShortcuts, setEnableKeyboardShortcuts] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [windowMaximized, setWindowMaximized] = useState(false);
  const windowMaximizedRef = useRef(windowMaximized); windowMaximizedRef.current = windowMaximized;
  const [vaultInitialized, setVaultInitialized] = useState(false);
  const [contentWidth, setContentWidth] = useState("900");
  const [fontSizeGlobal, setFontSizeGlobal] = useState(true);
  const [uiFontSize, setUiFontSize] = useState("14");
  const [contentFontSize, setContentFontSize] = useState("15");
  const [shortcutPalette, setShortcutPalette] = useState("Ctrl+P");
  const [shortcutNewNote, setShortcutNewNote] = useState("Ctrl+N");
  const [shortcutSave, setShortcutSave] = useState("Ctrl+S");
  const [shortcutCloseTab, setShortcutCloseTab] = useState("Ctrl+W");
  const [themeFile, setThemeFile] = useState("");
  const [toastPosition, setToastPosition] = useState("bottom-left");
  const [uiFont, setUiFont] = useState("HarmonyOS Sans");
  const [codeFont, setCodeFont] = useState("Cascadia Code");
  const [collapsedDirs, setCollapsedDirsState] = useState<Set<string>>(new Set());
  const [openTabs, setOpenTabsState] = useState<string[]>([]);
  const [selectedPath, setSelectedPathState] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [startup, _setStartup] = useState<StartupInfo | null>(null);

  // Refs for latest values
  const vaultsRef = useRef(vaults); vaultsRef.current = vaults;
  const activeVaultRef = useRef(activeVault); activeVaultRef.current = activeVault;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const languageRef = useRef(language);
  languageRef.current = language;
  const showQuickSettingsRef = useRef(showQuickSettings);
  showQuickSettingsRef.current = showQuickSettings;
  const enableShortcutsRef = useRef(enableKeyboardShortcuts);
  enableShortcutsRef.current = enableKeyboardShortcuts;
  const sidebarCollapsedRef = useRef(sidebarCollapsed);
  sidebarCollapsedRef.current = sidebarCollapsed;
  const vaultInitializedRef = useRef(vaultInitialized);
  vaultInitializedRef.current = vaultInitialized;
  const contentWidthRef = useRef(contentWidth);
  contentWidthRef.current = contentWidth;
  const fontSizeGlobalRef = useRef(fontSizeGlobal);
  fontSizeGlobalRef.current = fontSizeGlobal;
  const uiFontSizeRef = useRef(uiFontSize);
  uiFontSizeRef.current = uiFontSize;
  const contentFontSizeRef = useRef(contentFontSize);
  contentFontSizeRef.current = contentFontSize;
  const shortcutPaletteRef = useRef(shortcutPalette);
  shortcutPaletteRef.current = shortcutPalette;
  const shortcutNewNoteRef = useRef(shortcutNewNote);
  shortcutNewNoteRef.current = shortcutNewNote;
  const shortcutSaveRef = useRef(shortcutSave);
  shortcutSaveRef.current = shortcutSave;
  const shortcutCloseTabRef = useRef(shortcutCloseTab);
  shortcutCloseTabRef.current = shortcutCloseTab;
  const themeFileRef = useRef(themeFile);
  themeFileRef.current = themeFile;
  const toastPositionRef = useRef(toastPosition);
  toastPositionRef.current = toastPosition;
  const uiFontRef = useRef(uiFont);
  uiFontRef.current = uiFont;
  const codeFontRef = useRef(codeFont);
  codeFontRef.current = codeFont;
  const collapsedDirsRef = useRef(collapsedDirs);
  collapsedDirsRef.current = collapsedDirs;
  const openTabsRef = useRef(openTabs); openTabsRef.current = openTabs;
  const selectedPathRef = useRef(selectedPath); selectedPathRef.current = selectedPath;
  const doSave = useCallback(async (overrides?: Record<string, unknown>) => {
    const s = {
      vaultsJson: JSON.stringify(vaultsRef.current),
      activeVault: activeVaultRef.current,
      theme: themeRef.current,
      language: languageRef.current,
      showQuickSettings: showQuickSettingsRef.current,
      enableKeyboardShortcuts: enableShortcutsRef.current,
      sidebarCollapsed: sidebarCollapsedRef.current,
      windowMaximized: windowMaximizedRef.current,
      vaultInitialized: vaultInitializedRef.current,
      contentWidth: contentWidthRef.current,
      fontSizeGlobal: fontSizeGlobalRef.current,
      uiFontSize: uiFontSizeRef.current,
      contentFontSize: contentFontSizeRef.current,
      shortcutPalette: shortcutPaletteRef.current,
      shortcutNewNote: shortcutNewNoteRef.current,
      shortcutSave: shortcutSaveRef.current,
      shortcutCloseTab: shortcutCloseTabRef.current,
      themeFile: themeFileRef.current,
      toastPosition: toastPositionRef.current,
      uiFont: uiFontRef.current,
      codeFont: codeFontRef.current,
      collapsedDirsJson: JSON.stringify(Array.from(collapsedDirsRef.current)),
      openTabsJson: JSON.stringify(openTabsRef.current),
      selectedPath: selectedPathRef.current,
      ...overrides,
    };
    try {
      await appInvoke("save_user_settings", { settings: s });
    } catch (err) {
      console.error("WoxNote: failed to save settings", err);
    }
  }, []);
  // Load settings on mount
  useEffect(() => {
    void (async () => {
      const info = await appInvoke<StartupInfo>("startup_info");
      _setStartup(info);
      const settings = await appInvoke<UserSettings>("get_user_settings");
      try {
        const parsed = JSON.parse(settings.vaultsJson || "[]") as { name: string; path: string }[];
        setVaultsState(parsed);
      } catch { setVaultsState([]); }
      setActiveVaultState(settings.activeVault || "");
      setTheme(settings.theme || "dark");
      setLanguage(settings.language || "zh");
      setShowQuickSettings(settings.showQuickSettings ?? false);
      setEnableKeyboardShortcuts(settings.enableKeyboardShortcuts ?? true);
      setSidebarCollapsedState(settings.sidebarCollapsed ?? false);
      setWindowMaximized(settings.windowMaximized ?? false);
      setVaultInitialized(settings.vaultInitialized ?? false);
      setContentWidth(settings.contentWidth || "900");
      setFontSizeGlobal(settings.fontSizeGlobal !== false);
      setUiFontSize(settings.uiFontSize || "14");
      setContentFontSize(settings.contentFontSize || "15");
      setShortcutPalette(settings.shortcutPalette || "Ctrl+P");
      setShortcutNewNote(settings.shortcutNewNote || "Ctrl+N");
      setShortcutSave(settings.shortcutSave || "Ctrl+S");
      setShortcutCloseTab(settings.shortcutCloseTab || "Ctrl+W");
      setThemeFile(settings.themeFile || "");
      setToastPosition(settings.toastPosition || "bottom-left");
      setUiFont(settings.uiFont || "HarmonyOS Sans");
      setCodeFont(settings.codeFont || "Cascadia Code");
      try {
        const dirs = JSON.parse(settings.collapsedDirsJson || "[]") as string[];
        setCollapsedDirsState(new Set(dirs));
      } catch {
        setCollapsedDirsState(new Set());
      }
      try {
        const tabs = JSON.parse(settings.openTabsJson || "[]") as string[];
        setOpenTabsState(tabs);
      } catch { setOpenTabsState([]); }
      setSelectedPathState(settings.selectedPath || "");
      setSettingsLoaded(true);
    })();
  }, []);

  // Debounced save (exclude vaults/activeVault — addVault/removeVault handle their own save)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!settingsLoaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 300);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [theme, language, showQuickSettings, enableKeyboardShortcuts, sidebarCollapsed, vaultInitialized, contentWidth, fontSizeGlobal, uiFontSize, contentFontSize, shortcutPalette, shortcutNewNote, shortcutSave, shortcutCloseTab, themeFile, toastPosition, uiFont, codeFont, collapsedDirs, settingsLoaded, doSave]);

  // Flush on unload (synchronous via navigator.sendBeacon not possible, so we use sync XMLHttpRequest)
  useEffect(() => {
    const handler = () => {
      // Use synchronous approach for Tauri - but since Tauri owns the window,
      // the debounced save should already cover it. Add explicit flush here.
      void doSave();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [doSave]);

  // Flush on visibility change (Tauri hide)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "hidden") doSave();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, [doSave]);

  const setActiveVault = useCallback((path: string) => {
    if (path === activeVaultRef.current) return;
    setActiveVaultState(path);
    activeVaultRef.current = path;
    void doSave({ activeVault: path });
  }, [doSave]);

  const addVault = useCallback((name: string, path: string) => {
    const next = [...vaultsRef.current, { name, path }];
    setVaultsState(next);
    vaultsRef.current = next;
    void doSave({ vaultsJson: JSON.stringify(next) });
  }, [doSave]);

  const removeVault = useCallback((path: string) => {
    const next = vaultsRef.current.filter(v => v.path !== path);
    setVaultsState(next);
    vaultsRef.current = next;
    if (activeVaultRef.current === path) {
      setActiveVaultState("");
      activeVaultRef.current = "";
    }
    void doSave({ vaultsJson: JSON.stringify(next), activeVault: "" });
  }, [doSave]);

  // setSidebarCollapsed: supports callback form, saves immediately
  const setSidebarCollapsed = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setSidebarCollapsedState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      sidebarCollapsedRef.current = next;
      queueMicrotask(() => doSave({ sidebarCollapsed: next }));
      return next;
    });
  }, [doSave]);

  // setCollapsedDirs: supports callback form, saves immediately
  const setCollapsedDirs = useCallback((val: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setCollapsedDirsState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      collapsedDirsRef.current = next;
      queueMicrotask(() => doSave({ collapsedDirsJson: JSON.stringify(Array.from(next)) }));
      return next;
    });
  }, [doSave]);

  // setOpenTabs: supports callback form, saves immediately
  const setOpenTabs = useCallback((val: string[] | ((prev: string[]) => string[])) => {
    setOpenTabsState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      openTabsRef.current = next;
      queueMicrotask(() => doSave({ openTabsJson: JSON.stringify(next) }));
      return next;
    });
  }, [doSave]);

  // setSelectedPath: supports callback form, saves immediately
  const setSelectedPath = useCallback((val: string | ((prev: string) => string)) => {
    setSelectedPathState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      selectedPathRef.current = next;
      queueMicrotask(() => doSave({ selectedPath: next }));
      return next;
    });
  }, [doSave]);

  const chooseVaultFolder = useCallback(async (current?: string) => {
    const selected = await appInvoke<string | null>("choose_vault_folder", { current });
    return selected;
  }, []);

  return {
    vaults, addVault, removeVault,
    activeVault, setActiveVault,
    theme, setTheme,
    language, setLanguage,
    showQuickSettings, setShowQuickSettings,
    enableKeyboardShortcuts, setEnableKeyboardShortcuts,
    sidebarCollapsed, setSidebarCollapsed,
    windowMaximized, setWindowMaximized,
    vaultInitialized, setVaultInitialized,
    contentWidth, setContentWidth,
    fontSizeGlobal, setFontSizeGlobal,
    uiFontSize, setUiFontSize,
    contentFontSize, setContentFontSize,
    shortcutPalette, setShortcutPalette,
    shortcutNewNote, setShortcutNewNote,
    shortcutSave, setShortcutSave,
    shortcutCloseTab, setShortcutCloseTab,
    themeFile, setThemeFile,
    toastPosition, setToastPosition,
    uiFont, setUiFont,
    codeFont, setCodeFont,
    collapsedDirs, setCollapsedDirs,
    openTabs, setOpenTabs,
    selectedPath, setSelectedPath,
    settingsLoaded, startup,
    chooseVaultFolder,
  };
}
