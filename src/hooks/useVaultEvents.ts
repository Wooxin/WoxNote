import { useCallback, useEffect, useRef } from "react";
import type { NoteEntry } from "../types";
import { appInvoke } from "../bridge";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";

type TagEntry = { name: string; count: number };

/** Listens to vault-changed events (file added/removed/modified) and refreshes state. */
export function useVaultEvents(
  vaultPath: string,
  setEntries: (entries: NoteEntry[]) => void,
  setIsIndexed: (isIndexed: boolean) => void,
  setTagEntries: (tags: TagEntry[]) => void,
  setStatus: (status: string) => void,
  onGraphChanged: () => void,
) {
  const vaultPathRef = useRef(vaultPath);
  const pendingRef = useRef({
    added: new Set<string>(),
    modified: new Set<string>(),
    removed: new Set<string>(),
  });
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  vaultPathRef.current = vaultPath;

  const flushChanges = useCallback(async () => {
    const root = vaultPathRef.current;
    if (!root) return;

    const pending = pendingRef.current;
    const paths = new Set<string>([
      ...pending.added,
      ...pending.modified,
      ...pending.removed,
    ]);
    pendingRef.current = {
      added: new Set<string>(),
      modified: new Set<string>(),
      removed: new Set<string>(),
    };
    if (paths.size === 0) return;

    try {
      const list = await appInvoke<NoteEntry[]>("list_entries", { root });
      setEntries(list);
    } catch (error) {
      setStatus(String(error));
      return;
    }

    for (const path of paths) {
      try { await appInvoke("index_file", { root, relativePath: path }); } catch { /* ignore */ }
    }
    onGraphChanged();

    try {
      const tags = await appInvoke<TagEntry[]>("get_all_tags");
      setTagEntries(tags);
    } catch { /* ignore */ }
  }, [onGraphChanged, setEntries, setStatus, setTagEntries]);

  useEffect(() => {
    if (!isTauri()) return;

    const unlistenVault = listen<{ added: string[]; removed: string[]; modified: string[] }>(
      "vault-changed",
      (event) => {
        const pending = pendingRef.current;
        event.payload.added.forEach((path) => pending.added.add(path));
        event.payload.modified.forEach((path) => pending.modified.add(path));
        event.payload.removed.forEach((path) => pending.removed.add(path));

        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = setTimeout(() => {
          void flushChanges();
        }, 250);
      }
    );

    const unlistenIndex = listen<{ path: string; ok: boolean; message: string }>(
      "index-complete",
      async (event) => {
        const root = vaultPathRef.current;
        if (!root || event.payload.path !== root) return;
        setIsIndexed(event.payload.ok);
        if (!event.payload.ok) {
          setStatus(event.payload.message || "Indexing failed");
          return;
        }
        try {
          const tags = await appInvoke<TagEntry[]>("get_all_tags");
          setTagEntries(tags);
        } catch { /* ignore */ }
        onGraphChanged();
      }
    );

    return () => {
      clearTimeout(flushTimerRef.current);
      void unlistenVault.then((fn) => fn());
      void unlistenIndex.then((fn) => fn());
    };
  }, [flushChanges, onGraphChanged, setEntries, setIsIndexed, setStatus, setTagEntries]);
}
