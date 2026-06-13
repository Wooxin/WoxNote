export type StartupInfo = {
  suggestions: VaultSuggestion[];
  defaultPath: string;
  appDataPath: string;
};

export type VaultSuggestion = {
  name: string;
  path: string;
  kind: "sync" | "local";
};

export type NoteEntry = {
  name: string;
  path: string;
  extension: string;
  isDir: boolean;
  size: number;
  modified: number;
};

export type TaskEntry = {
  id: string;
  path: string;
  title: string;
  line: number;
  text: string;
  completed: boolean;
};

export type LineRevealRequest = {
  line: number;
  nonce: number;
};

export type BacklinkEntry = {
  path: string;
  line: number;
  snippet: string;
};

export type MentionEntry = {
  path: string;
  line: number;
  snippet: string;
};

export type Preview =
  | { type: "empty" }
  | { type: "markdown"; content: string }
  | { type: "text"; content: string }
  | { type: "pdf"; url: string }
  | { type: "image"; url: string }
  | { type: "sheet"; sheets: SheetPreview[] }
  | { type: "document"; text: string }
  | { type: "slides"; slides: string[] }
  | { type: "unsupported"; message: string };

export type SheetPreview = {
  name: string;
  rows: string[][];
};

export type ViewMode = "source" | "reading" | "split";
export type ThemeMode = "dark" | "light";
export type Language = "zh" | "en";

export type VaultInfo = {
  name: string;
  path: string;
};

export type UserSettings = {
  vaultsJson: string;
  activeVault: string;
  theme: ThemeMode;
  language: Language;
  showQuickSettings: boolean;
  enableKeyboardShortcuts: boolean;
  sidebarCollapsed: boolean;
  windowMaximized: boolean;
  vaultInitialized: boolean;
  contentWidth: string;
  fontSizeGlobal: boolean;
  uiFontSize: string;
  contentFontSize: string;
  shortcutPalette: string;
  shortcutNewNote: string;
  shortcutSave: string;
  shortcutCloseTab: string;
  themeFile: string;
  toastPosition: string;
  uiFont: string;
  codeFont: string;
  collapsedDirsJson: string;
  openTabsJson: string;
  selectedPath: string;
};
