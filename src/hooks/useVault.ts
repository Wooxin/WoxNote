import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import type { BacklinkEntry, LineRevealRequest, MentionEntry, NoteEntry, Preview, TaskEntry } from "../types";
import type { Messages } from "../i18n";
import { EDITABLE_EXTENSIONS, NOTE_EXTENSIONS, TEXT_EXTENSIONS } from "../constants";
import { buildBinaryPreview } from "../utils/preview";
import { appInvoke } from "../bridge";
import { useAutoSave } from "./useAutoSave";
import { useVaultSearch } from "./useVaultSearch";
import { useVaultLinks } from "./useVaultLinks";
import { useVaultEvents } from "./useVaultEvents";
import { titleFromPath } from "../utils/helpers";

type TagEntry = { name: string; count: number };
type SearchResult = { path: string; title: string; snippet: string; line: number; score: number };

function extractTasks(path: string, content: string): TaskEntry[] {
  const title = path.split("/").pop()?.replace(/\.(md|markdown|novel)$/i, "") ?? path;
  const tasks: TaskEntry[] = [];
  content.split(/\r?\n/).forEach((line, index) => {
    const match = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.+)$/);
    if (!match) return;
    tasks.push({
      id: `${path}:${index + 1}`,
      path,
      title,
      line: index + 1,
      text: match[2].trim(),
      completed: match[1].toLowerCase() === "x",
    });
  });
  return tasks;
}

function todayNoteName() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function rewriteMovedPath(path: string, oldPath: string, newPath: string): string {
  if (path === oldPath) return newPath;
  if (path.startsWith(oldPath + "/")) return newPath + path.slice(oldPath.length);
  return path;
}

export function useVault(
  vaultPath: string,
  t: Messages,
  collapsedDirs: Set<string>,
  setCollapsedDirs: (dirs: Set<string>) => void,
  openTabs: string[],
  setOpenTabs: (val: string[] | ((prev: string[]) => string[])) => void,
  selectedPath: string,
  setSelectedPath: (val: string | ((prev: string) => string)) => void,
) {
  const vaultPathRef = useRef(vaultPath);
  vaultPathRef.current = vaultPath;
  const loadRequestRef = useRef(0);

  const [entries, setEntries] = useState<NoteEntry[]>([]);
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState<Preview>({ type: "empty" });
  const [isDirty, setIsDirty] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState(t.welcomeStatus);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [lineRevealRequest, setLineRevealRequest] = useState<LineRevealRequest | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: NoteEntry } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NoteEntry | null>(null);
  const [renamingEntry, setRenamingEntry] = useState<NoteEntry | null>(null);
  const [graphRefreshKey, setGraphRefreshKey] = useState(0);

  const selectedEntry = useMemo(() => entries.find((e) => e.path === selectedPath), [entries, selectedPath]);
  const files = useMemo(() => entries.filter((e) => !e.isDir), [entries]);
  const notes = useMemo(() => files.filter((e) => NOTE_EXTENSIONS.has(e.extension)), [files]);
  const canEdit = Boolean(selectedEntry && !selectedEntry.isDir && EDITABLE_EXTENSIONS.has(selectedEntry.extension));
  const canReadMarkdown = Boolean(selectedEntry && NOTE_EXTENSIONS.has(selectedEntry.extension));

  const search = useVaultSearch(entries, files, collapsedDirs);
  const bumpGraphRefresh = useCallback(() => setGraphRefreshKey((key) => key + 1), []);
  useVaultEvents(vaultPath, setEntries, search.setIsIndexed, search.setTagEntries, setStatus, bumpGraphRefresh);

  const refreshEntries = useCallback(async (path: string): Promise<NoteEntry[]> => {
    if (!path) return [];
    setStatus(t.scanningVault);
    const list = await appInvoke<NoteEntry[]>("list_entries", { root: path });
    setEntries(list);
    setStatus(t.vaultReadyPrefix + " " + list.filter((e) => !e.isDir).length + " " + t.vaultReadySuffix);
    return list;
  }, [t.scanningVault, t.vaultReadyPrefix, t.vaultReadySuffix]);

  const saveCurrent = useCallback(async () => {
    const root = vaultPathRef.current;
    if (!selectedEntry || selectedEntry.isDir || !EDITABLE_EXTENSIONS.has(selectedEntry.extension)) return;
    await appInvoke("write_text_file", { root, relativePath: selectedEntry.path, content });
    setIsDirty(false);
    setPreview(canReadMarkdown ? { type: "markdown", content } : { type: "text", content });
    setStatus(t.savedPrefix + " " + selectedEntry.name);
    try {
      await appInvoke("index_file", { root, relativePath: selectedEntry.path });
      bumpGraphRefresh();
      const tags = await appInvoke<TagEntry[]>("get_all_tags");
      search.setTagEntries(tags);
    } catch { /* ignore */ }
  }, [bumpGraphRefresh, content, selectedEntry, canReadMarkdown, search, t.savedPrefix]);

  const loadFile = useCallback(async (entry: NoteEntry, requestId: number) => {
    const root = vaultPathRef.current;
    if (entry.isDir || !root) return;
    const isCurrentRequest = () => loadRequestRef.current === requestId;
    try {
      if (TEXT_EXTENSIONS.has(entry.extension)) {
        const text = await appInvoke<string>("read_text_file", { root, relativePath: entry.path });
        if (!isCurrentRequest()) return;
        setContent(text);
        setPreview(NOTE_EXTENSIONS.has(entry.extension) ? { type: "markdown", content: text } : { type: "text", content: text });
      } else {
        setContent("");
        setPreview({ type: "empty" });
        setStatus(t.loadingVault);
        const ext = entry.extension;
        if (ext === "xlsx" || ext === "xls" || ext === "docx" || ext === "pptx") {
          try {
            const data = await appInvoke<{ type: string; sheets: { name: string; rows: string[][] }[]; text: string; slides: string[]; message: string }>("preview_binary", { root, relativePath: entry.path });
            if (!isCurrentRequest()) return;
            if (data.type === "sheet") setPreview({ type: "sheet", sheets: data.sheets });
            else if (data.type === "document") setPreview({ type: "document", text: data.text });
            else if (data.type === "slides") setPreview({ type: "slides", slides: data.slides });
            else throw new Error("unsupported");
          } catch {
            const bytes = await appInvoke<number[]>("read_binary_file", { root, relativePath: entry.path });
            const nextPreview = await buildBinaryPreview(entry, bytes, t);
            if (!isCurrentRequest()) return;
            setPreview(nextPreview);
          }
        } else {
          const bytes = await appInvoke<number[]>("read_binary_file", { root, relativePath: entry.path });
          const nextPreview = await buildBinaryPreview(entry, bytes, t);
          if (!isCurrentRequest()) return;
          setPreview(nextPreview);
        }
        if (!isCurrentRequest()) return;
        setStatus(t.vaultOpenedPrefix + " " + entry.name);
        return;
      }
      if (!isCurrentRequest()) return;
      setIsDirty(false);
      setStatus(t.vaultOpenedPrefix + " " + entry.name);
    } catch (error) {
      if (isCurrentRequest()) setStatus(String(error));
    }
  }, [t]);

  const handleSelectFile = useCallback(async (entry: NoteEntry) => {
    const root = vaultPathRef.current;
    if (entry.isDir || !root) return;
    if (isDirty) await saveCurrent();
    const requestId = ++loadRequestRef.current;
    setSelectedPath(entry.path);
    setOpenTabs((cur) => cur.includes(entry.path) ? cur : [...cur, entry.path]);
    setStatus(t.vaultOpening + " " + entry.name);
    setPreview({ type: "empty" });
    setIsPaletteOpen(false);
    await loadFile(entry, requestId);
  }, [isDirty, loadFile, saveCurrent, t.vaultOpening]);

  const reindexVault = useCallback(async (root: string) => {
    search.setIsIndexed(false);
    await appInvoke("reindex_vault", { path: root });
    if (!isTauri()) {
      search.setIsIndexed(true);
      try {
        const tags = await appInvoke<TagEntry[]>("get_all_tags");
        search.setTagEntries(tags);
      } catch { /* ignore */ }
      bumpGraphRefresh();
    }
  }, [bumpGraphRefresh, search]);

  const createLinkedNote = useCallback(async (title: string) => {
    const root = vaultPathRef.current;
    const cleanTitle = title.trim();
    if (!root || !cleanTitle) return;
    if (isDirty) await saveCurrent();
    const path = await appInvoke<string>("create_note", { root, title: cleanTitle });
    const list = await refreshEntries(root);
    const created = list.find((entry) => entry.path === path) ?? {
      name: path.split("/").pop() ?? path,
      path,
      extension: "md",
      isDir: false,
      size: 0,
      modified: Date.now() / 1000,
    };
    try {
      await appInvoke("index_file", { root, relativePath: path });
      bumpGraphRefresh();
    } catch { /* ignore */ }
    await handleSelectFile(created);
  }, [bumpGraphRefresh, handleSelectFile, isDirty, refreshEntries, saveCurrent]);

  const links = useVaultLinks(vaultPath, selectedPath, search.isIndexed, notes, handleSelectFile, createLinkedNote, setStatus, graphRefreshKey);

  const createNote = useCallback(async () => {
    const root = vaultPathRef.current;
    if (!root) return;
    const path = await appInvoke<string>("create_note", { root, title: t.untitled });
    await refreshEntries(root);
    const created: NoteEntry = { name: path.split("/").pop() ?? path, path, extension: "md", isDir: false, size: 0, modified: Date.now() / 1000 };
    await handleSelectFile(created);
  }, [handleSelectFile, refreshEntries, t.untitled]);

  const openDailyNote = useCallback(async () => {
    const root = vaultPathRef.current;
    if (!root) return;
    if (isDirty) await saveCurrent();
    const title = todayNoteName();
    const path = `Daily/${title}.md`;
    let list = entries;
    let entry = list.find((item) => item.path === path);
    if (!entry) {
      const content = `# ${title}\n\n## Tasks\n\n- [ ] \n\n## Notes\n\n`;
      await appInvoke("write_text_file", { root, relativePath: path, content });
      try { await appInvoke("index_file", { root, relativePath: path }); } catch { /* ignore */ }
      list = await refreshEntries(root);
      entry = list.find((item) => item.path === path);
    }
    const dailyEntry: NoteEntry = entry ?? { name: `${title}.md`, path, extension: "md", isDir: false, size: 0, modified: Date.now() / 1000 };
    await handleSelectFile(dailyEntry);
  }, [entries, handleSelectFile, isDirty, refreshEntries, saveCurrent]);

  const refreshTasks = useCallback(async () => {
    const root = vaultPathRef.current;
    if (!root) {
      setTasks([]);
      return;
    }
    setIsLoadingTasks(true);
    try {
      const next: TaskEntry[] = [];
      for (const note of notes) {
        try {
          const text = note.path === selectedPath && canReadMarkdown ? content : await appInvoke<string>("read_text_file", { root, relativePath: note.path });
          next.push(...extractTasks(note.path, text));
        } catch { /* ignore unreadable note */ }
      }
      next.sort((a, b) => Number(a.completed) - Number(b.completed) || a.path.localeCompare(b.path) || a.line - b.line);
      setTasks(next);
    } finally {
      setIsLoadingTasks(false);
    }
  }, [canReadMarkdown, content, notes, selectedPath]);

  const openTask = useCallback(async (task: TaskEntry) => {
    const entry = entries.find((item) => item.path === task.path);
    if (!entry || entry.isDir) return;
    setIsTasksOpen(false);
    await handleSelectFile(entry);
    setLineRevealRequest({ line: task.line, nonce: Date.now() });
  }, [entries, handleSelectFile]);

  const openSearchResult = useCallback(async (result: SearchResult) => {
    const entry = entries.find((item) => item.path === result.path);
    if (!entry || entry.isDir) return;
    search.setGlobalSearch("");
    await handleSelectFile(entry);
    setLineRevealRequest({ line: result.line || 1, nonce: Date.now() });
  }, [entries, handleSelectFile, search]);

  const openBacklink = useCallback(async (backlink: BacklinkEntry) => {
    const entry = entries.find((item) => item.path === backlink.path);
    if (!entry || entry.isDir) return;
    await handleSelectFile(entry);
    setLineRevealRequest({ line: backlink.line || 1, nonce: Date.now() });
  }, [entries, handleSelectFile]);

  const openMention = useCallback(async (mention: MentionEntry) => {
    const entry = entries.find((item) => item.path === mention.path);
    if (!entry || entry.isDir) return;
    await handleSelectFile(entry);
    setLineRevealRequest({ line: mention.line || 1, nonce: Date.now() });
  }, [entries, handleSelectFile]);

  const linkMention = useCallback(async (mention: MentionEntry) => {
    const root = vaultPathRef.current;
    if (!root || !selectedPath) return;
    const title = titleFromPath(selectedPath);
    const source = mention.path === selectedPath && canReadMarkdown ? content : await appInvoke<string>("read_text_file", { root, relativePath: mention.path });
    const lines = source.split(/\r?\n/);
    const index = mention.line - 1;
    const line = lines[index];
    if (!line) return;
    const pattern = new RegExp(escapeRegExp(title), "i");
    const nextLine = line.replace(pattern, `[[${title}]]`);
    if (nextLine === line) return;
    lines[index] = nextLine;
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    const nextContent = lines.join(newline);
    await appInvoke("write_text_file", { root, relativePath: mention.path, content: nextContent });
    if (mention.path === selectedPath) {
      setContent(nextContent);
      setPreview(canReadMarkdown ? { type: "markdown", content: nextContent } : { type: "text", content: nextContent });
      setIsDirty(false);
    }
    try {
      await appInvoke("index_file", { root, relativePath: mention.path });
      bumpGraphRefresh();
    } catch { /* ignore */ }
    await openMention(mention);
  }, [bumpGraphRefresh, canReadMarkdown, content, openMention, selectedPath]);

  const toggleTask = useCallback(async (task: TaskEntry) => {
    const root = vaultPathRef.current;
    if (!root) return;
    const source = task.path === selectedPath && canReadMarkdown ? content : await appInvoke<string>("read_text_file", { root, relativePath: task.path });
    const lines = source.split(/\r?\n/);
    const index = task.line - 1;
    const line = lines[index];
    if (!line) return;
    const nextLine = line.replace(/^(\s*[-*]\s+\[)( |x|X)(\]\s+)/, (_, prefix: string, mark: string, suffix: string) => (
      `${prefix}${mark.toLowerCase() === "x" ? " " : "x"}${suffix}`
    ));
    if (nextLine === line) return;
    lines[index] = nextLine;
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    const nextContent = lines.join(newline);
    await appInvoke("write_text_file", { root, relativePath: task.path, content: nextContent });
    if (task.path === selectedPath) {
      setContent(nextContent);
      setPreview(canReadMarkdown ? { type: "markdown", content: nextContent } : { type: "text", content: nextContent });
      setIsDirty(false);
    }
    try {
      await appInvoke("index_file", { root, relativePath: task.path });
      bumpGraphRefresh();
    } catch { /* ignore */ }
    await refreshTasks();
  }, [bumpGraphRefresh, canReadMarkdown, content, refreshTasks, selectedPath]);

  const closeTab = useCallback(async (path: string) => {
    if (selectedPath === path && isDirty) await saveCurrent();

    const nextTabs = openTabs.filter((item) => item !== path);
    setOpenTabs(nextTabs);
    if (selectedPath !== path) return;

    const fallback = nextTabs[nextTabs.length - 1] ?? "";
    const entry = entries.find((e) => e.path === fallback);
    if (entry) void handleSelectFile(entry);
    else {
      setSelectedPath("");
      setContent("");
      setPreview({ type: "empty" });
      setIsDirty(false);
    }
  }, [entries, handleSelectFile, isDirty, openTabs, saveCurrent, selectedPath]);

  const deleteEntry = useCallback(async (entry: NoteEntry) => {
    const root = vaultPathRef.current;
    if (!root) return;
    await appInvoke("delete_entry", { root, relativePath: entry.path });
    setContextMenu(null);
    setOpenTabs((cur) => cur.filter((p) => p !== entry.path && !p.startsWith(entry.path + "/")));
    if (selectedPath === entry.path || selectedPath.startsWith(entry.path + "/")) {
      setSelectedPath(""); setContent(""); setPreview({ type: "empty" }); setIsDirty(false);
    }
    await refreshEntries(root);
    try {
      if (entry.isDir) {
        await reindexVault(root);
      } else {
        await appInvoke("index_file", { root, relativePath: entry.path });
        bumpGraphRefresh();
        const tags = await appInvoke<TagEntry[]>("get_all_tags");
        search.setTagEntries(tags);
      }
    } catch { /* ignore */ }
    setStatus(t.deletedPrefix + " " + entry.name);
  }, [bumpGraphRefresh, refreshEntries, reindexVault, selectedPath, t.deletedPrefix, search]);

  const renameEntry = useCallback(async (entry: NoteEntry, newName: string): Promise<string | null> => {
    const root = vaultPathRef.current;
    const cleanName = newName.trim();
    if (!root || !cleanName) return null;

    const affectsSelected = selectedPath === entry.path || selectedPath.startsWith(entry.path + "/");
    if (isDirty && affectsSelected) await saveCurrent();

    const newPath = !entry.isDir && NOTE_EXTENSIONS.has(entry.extension)
      ? await appInvoke<string>("rename_note_with_links", { vaultPath: root, oldRelative: entry.path, newName: cleanName })
      : await appInvoke<string>("rename_entry", { root, oldPath: entry.path, newName: cleanName });

    const list = await refreshEntries(root);
    setOpenTabs((cur) => cur.map((path) => rewriteMovedPath(path, entry.path, newPath)));
    setSelectedPath((current) => rewriteMovedPath(current, entry.path, newPath));
    setRenamingEntry(null);

    try {
      if (entry.isDir) {
        await reindexVault(root);
      } else {
        await appInvoke("index_file", { root, relativePath: entry.path });
        await appInvoke("index_file", { root, relativePath: newPath });
        const tags = await appInvoke<TagEntry[]>("get_all_tags");
        search.setTagEntries(tags);
        bumpGraphRefresh();
      }
    } catch { /* ignore */ }

    const renamed = list.find((item) => item.path === newPath);
    setStatus(t.rename + " " + (renamed?.name ?? cleanName));
    return newPath;
  }, [bumpGraphRefresh, isDirty, refreshEntries, reindexVault, saveCurrent, search, selectedPath, t.rename]);

  const activateVault = useCallback(async (path: string): Promise<NoteEntry[]> => {
    const cleanPath = path.trim();
    if (!cleanPath) return [];
    setIsLoading(true);
    setStatus(t.vaultOpening);
    search.setIsIndexed(false);
    await appInvoke("ensure_vault", { path: cleanPath });
    const list = await refreshEntries(cleanPath);
    try {
      await reindexVault(cleanPath);
    } catch { /* ignore */ }
    try { await appInvoke("start_watching_vault", { path: cleanPath }); } catch { /* ignore */ }
    setIsLoading(false);

    // Restore session: reopen tabs that still exist in the vault
    const validTabs = openTabs.filter((tabPath: string) => list.some((e) => e.path === tabPath));
    const fallback = validTabs.length > 0
      ? (list.some((e) => e.path === selectedPath) ? selectedPath : validTabs[validTabs.length - 1])
      : "";
    if (fallback) {
      setOpenTabs(validTabs);
      setSelectedPath(fallback);
      const entry = list.find((e) => e.path === fallback);
      if (entry && !entry.isDir) {
        const requestId = ++loadRequestRef.current;
        await loadFile(entry, requestId);
      }
    }
    return list;
  }, [refreshEntries, reindexVault, t.vaultOpening, search, openTabs, selectedPath, setOpenTabs, setSelectedPath, loadFile]);

  const handleContentChange = useCallback((next: string) => {
    setContent(next);
    setIsDirty(true);
    if (canReadMarkdown) setPreview({ type: "markdown", content: next });
  }, [canReadMarkdown]);

  useAutoSave(isDirty, content, selectedEntry, saveCurrent);

  const toggleDirCollapse = useCallback((dirPath: string) => {
    const next = new Set(collapsedDirs);
    next.has(dirPath) ? next.delete(dirPath) : next.add(dirPath);
    setCollapsedDirs(next);
  }, [collapsedDirs, setCollapsedDirs]);

  useEffect(() => {
    const url = (preview as { url?: string }).url;
    if (url) return () => URL.revokeObjectURL(url);
  }, [preview]);

  return {
    entries, selectedPath, openTabs,
    globalSearch: search.globalSearch, setGlobalSearch: search.setGlobalSearch,
    quickQuery: search.quickQuery, setQuickQuery: search.setQuickQuery,
    content, preview, isDirty, setIsDirty, isLoading,
    isPaletteOpen, setIsPaletteOpen,
    isSettingsOpen, setIsSettingsOpen,
    isTasksOpen, setIsTasksOpen,
    isGraphOpen, setIsGraphOpen,
    tasks, isLoadingTasks, refreshTasks, openTask, toggleTask, openSearchResult, openBacklink, openMention, linkMention, lineRevealRequest,
    contextMenu, setContextMenu,
    deleteTarget, setDeleteTarget,
    renamingEntry, setRenamingEntry,
    status,
    selectedEntry, files, notes,
    visibleEntries: search.visibleEntries,
    quickResults: search.quickResults,
    ftsResults: search.ftsResults,
    tags: search.tagEntries,
    links: links.forwardLinks,
    backlinks: links.backlinks,
    unlinkedMentions: links.unlinkedMentions,
    canEdit, canReadMarkdown,
    refreshEntries, activateVault,
    saveCurrent, handleSelectFile,
    createNote, openDailyNote, closeTab, deleteEntry, renameEntry,
    openLinkByTitle: links.openLinkByTitle,
    handleContentChange,
    toggleDirCollapse,
    collapsedDirs,
  };
}
