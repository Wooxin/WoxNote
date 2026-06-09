import { useCallback, useEffect, useRef, useState } from "react";
import type { Language, StartupInfo, ThemeMode, UserSettings } from "../types";
import { appInvoke } from "../bridge";

export function useSettings() {
  const [vaultPath, setVaultPathState] = useState("");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [language, setLanguage] = useState<Language>("zh");
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [enableKeyboardShortcuts, setEnableKeyboardShortcuts] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(false);
  const [windowMaximized, setWindowMaximized] = useState(false);
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
  const [lastOpenedPath, setLastOpenedPathState] = useState("");
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [startup, setStartup] = useState<StartupInfo | null>(null);

  // Refs for latest values (used by flushSave and immediate saves)
  const vaultPathRef = useRef(vaultPath);
  vaultPathRef.current = vaultPath;
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
  const lastOpenedPathRef = useRef(lastOpenedPath);
  lastOpenedPathRef.current = lastOpenedPath;

  const doSave = useCallback(async (overrides?: Record<string, unknown>) => {
    const s = {
      vaultPath: vaultPathRef.current,
      theme: themeRef.current,
      language: languageRef.current,
      showQuickSettings: showQuickSettingsRef.current,
      enableKeyboardShortcuts: enableShortcutsRef.current,
      sidebarCollapsed: sidebarCollapsedRef.current,
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
      lastOpenedPath: lastOpenedPathRef.current,
      ...overrides,
    };
    try {
      await appInvoke("save_user_settings", { settings: s });
    } catch (err) {
      console.warn("Failed to save settings:", err);
    }
  }, []);
  // Load settings on mount
  useEffect(() => {
    void (async () => {
      const info = await appInvoke<StartupInfo>("startup_info");
      setStartup(info);
      const settings = await appInvoke<UserSettings>("get_user_settings");
      setVaultPathState(settings.vaultPath || info.defaultPath);
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
      setLastOpenedPathState(settings.lastOpenedPath || "");
      try {
        const dirs = JSON.parse(settings.collapsedDirsJson || "[]") as string[];
        setCollapsedDirsState(new Set(dirs));
      } catch {
        setCollapsedDirsState(new Set());
      }
      setSettingsLoaded(true);
    })();
  }, []);

  // Debounced save
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!settingsLoaded) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(doSave, 300);
    return () => clearTimeout(saveTimer.current);
  }, [vaultPath, theme, language, showQuickSettings, enableKeyboardShortcuts, sidebarCollapsed, vaultInitialized, contentWidth, fontSizeGlobal, uiFontSize, contentFontSize, shortcutPalette, shortcutNewNote, shortcutSave, shortcutCloseTab, themeFile, toastPosition, uiFont, codeFont, collapsedDirs, lastOpenedPath, settingsLoaded, doSave]);

  // Flush on unload
  useEffect(() => {
    const handler = () => doSave();
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

  // setVaultPath: save immediately
  const setVaultPath = useCallback((path: string) => {
    setVaultPathState(path);
    vaultPathRef.current = path;
    queueMicrotask(() => doSave({ vaultPath: path }));
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

  const chooseVaultFolder = useCallback(async () => {
    const selected = await appInvoke<string | null>("choose_vault_folder", {
      current: vaultPath || startup?.defaultPath,
    });
    if (selected) setVaultPath(selected);
    return selected;
  }, [startup?.defaultPath, vaultPath, setVaultPath]);

  return {
    vaultPath, setVaultPath,
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
    settingsLoaded, startup,
    lastOpenedPath, setLastOpenedPath: setLastOpenedPathState,
    chooseVaultFolder,
  };
}
