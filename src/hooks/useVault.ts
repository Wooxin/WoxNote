import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import type { NoteEntry, Preview } from "../types";
import type { Messages } from "../i18n";
import { EDITABLE_EXTENSIONS, NOTE_EXTENSIONS, TEXT_EXTENSIONS } from "../constants";
import { buildBinaryPreview } from "../utils/preview";
import { appInvoke } from "../bridge";
import { useAutoSave } from "./useAutoSave";
import { useVaultSearch } from "./useVaultSearch";
import { useVaultLinks } from "./useVaultLinks";
import { useVaultEvents } from "./useVaultEvents";

type TagEntry = { name: string; count: number };

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

  const links = useVaultLinks(selectedPath, search.isIndexed, notes, handleSelectFile, setStatus, graphRefreshKey);

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

  const createNote = useCallback(async () => {
    const root = vaultPathRef.current;
    if (!root) return;
    const path = await appInvoke<string>("create_note", { root, title: t.untitled });
    await refreshEntries(root);
    const created: NoteEntry = { name: path.split("/").pop() ?? path, path, extension: "md", isDir: false, size: 0, modified: Date.now() / 1000 };
    await handleSelectFile(created);
  }, [handleSelectFile, refreshEntries, t.untitled]);

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
    backlinks: links.backlinkPaths,
    canEdit, canReadMarkdown,
    refreshEntries, activateVault,
    saveCurrent, handleSelectFile,
    createNote, closeTab, deleteEntry, renameEntry,
    openLinkByTitle: links.openLinkByTitle,
    handleContentChange,
    toggleDirCollapse,
    collapsedDirs,
  };
}
