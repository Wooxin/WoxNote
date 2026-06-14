import React, { createContext, useContext, useState } from "react";
import { useVault } from "../hooks/useVault";
import { useAppContext } from "./AppContext";
import type { BacklinkEntry, EditorInsertRequest, LineRevealRequest, MentionEntry, NoteEntry, Preview, TaskEntry } from "../types";

type SearchResult = { path: string; title: string; snippet: string; line: number; score: number };
type TagEntry = { name: string; count: number };

export type VaultContextType = {
  entries: NoteEntry[];
  selectedPath: string;
  openTabs: string[];
  globalSearch: string;
  setGlobalSearch: (v: string) => void;
  quickQuery: string;
  setQuickQuery: (v: string) => void;
  content: string;
  preview: Preview;
  isDirty: boolean;
  setIsDirty: (v: boolean) => void;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  isPaletteOpen: boolean;
  setIsPaletteOpen: (v: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (v: boolean) => void;
  isTasksOpen: boolean;
  setIsTasksOpen: (v: boolean) => void;
  isGraphOpen: boolean;
  setIsGraphOpen: (v: boolean) => void;
  tasks: TaskEntry[];
  isLoadingTasks: boolean;
  lineRevealRequest: LineRevealRequest | null;
  editorInsertRequest: EditorInsertRequest | null;
  refreshTasks: () => Promise<void>;
  openTask: (task: TaskEntry) => Promise<void>;
  toggleTask: (task: TaskEntry) => Promise<void>;
  openSearchResult: (result: SearchResult) => Promise<void>;
  openBacklink: (backlink: BacklinkEntry) => Promise<void>;
  openMention: (mention: MentionEntry) => Promise<void>;
  linkMention: (mention: MentionEntry) => Promise<void>;
  contextMenu: { x: number; y: number; entry: NoteEntry } | null;
  setContextMenu: (v: { x: number; y: number; entry: NoteEntry } | null) => void;
  deleteTarget: NoteEntry | null;
  setDeleteTarget: (v: NoteEntry | null) => void;
  renamingEntry: NoteEntry | null;
  setRenamingEntry: (v: NoteEntry | null) => void;
  status: string;

  selectedEntry: NoteEntry | undefined;
  files: NoteEntry[];
  notes: NoteEntry[];
  recentEntries: NoteEntry[];
  visibleEntries: NoteEntry[];
  quickResults: NoteEntry[];
  ftsResults: SearchResult[];
  tags: TagEntry[];
  links: string[];
  backlinks: BacklinkEntry[];
  unlinkedMentions: MentionEntry[];
  canEdit: boolean;
  refreshEntries: (path: string) => Promise<NoteEntry[]>;
  activateVault: (path: string) => Promise<NoteEntry[]>;
  saveCurrent: () => Promise<void>;
  handleSelectFile: (entry: NoteEntry) => Promise<void>;
  createNote: () => Promise<void>;
  createNoteWithTitle: (title: string) => Promise<void>;
  openDailyNote: () => Promise<void>;
  insertTextAtCursor: (text: string) => void;
  insertTemplate: (template: NoteEntry) => Promise<void>;
  closeTab: (path: string) => Promise<void>;
  deleteEntry: (entry: NoteEntry) => Promise<void>;
  renameEntry: (entry: NoteEntry, newName: string) => Promise<string | null>;
  openLinkByTitle: (title: string) => void;
  handleContentChange: (next: string) => void;
  toggleDirCollapse: (dirPath: string) => void;
  scrollToHeading: ((text: string) => void) | null;
  setScrollToHeading: (fn: ((text: string) => void) | null) => void;
};

const VaultCtx = createContext<VaultContextType | null>(null);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const { activeVault, t, collapsedDirs, setCollapsedDirs, openTabs, setOpenTabs, selectedPath, setSelectedPath } = useAppContext();
  const vault = useVault(activeVault, t, collapsedDirs, setCollapsedDirs, openTabs, setOpenTabs, selectedPath, setSelectedPath);
  const [scrollToHeading, setScrollToHeading] = useState<((text: string) => void) | null>(null);

  return (
    <VaultCtx.Provider value={{ ...vault, scrollToHeading, setScrollToHeading }}>
      {children}
    </VaultCtx.Provider>
  );
}

export function useVaultContext() {
  const ctx = useContext(VaultCtx);
  if (!ctx) throw new Error("useVaultContext must be used within VaultProvider");
  return ctx;
}
