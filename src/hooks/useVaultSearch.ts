import { useEffect, useMemo, useState } from "react";
import type { NoteEntry } from "../types";
import { appInvoke } from "../bridge";

type SearchResult = { path: string; title: string; snippet: string; score: number };
type TagEntry = { name: string; count: number };

export function useVaultSearch(
  entries: NoteEntry[],
  files: NoteEntry[],
  collapsedDirs: Set<string>,
) {
  const [globalSearch, setGlobalSearch] = useState("");
  const [quickQuery, setQuickQuery] = useState("");
  const [ftsResults, setFtsResults] = useState<SearchResult[]>([]);
  const [tagEntries, setTagEntries] = useState<TagEntry[]>([]);
  const [isIndexed, setIsIndexed] = useState(false);

  // Derived: visible entries filtered by search + collapsed dirs
  const visibleEntries = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (query) {
      return entries.filter((entry) => entry.path.toLowerCase().includes(query));
    }

    const result = entries;
    return result.filter((entry) => {
      const parts = entry.path.split("/");
      for (let i = 0; i < parts.length - 1; i++) {
        if (collapsedDirs.has(parts.slice(0, i + 1).join("/"))) return false;
      }
      return true;
    });
  }, [entries, globalSearch, collapsedDirs]);

  const quickResults = useMemo(() => {
    const normalized = quickQuery.trim().toLowerCase();
    const source = normalized
      ? files.filter((entry) => entry.path.toLowerCase().includes(normalized))
      : files;
    return source.slice(0, 12);
  }, [files, quickQuery]);

  // FTS search (debounced)
  useEffect(() => {
    if (!isIndexed || !globalSearch.trim()) {
      setFtsResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await appInvoke<SearchResult[]>("search_vault", { query: globalSearch.trim() });
        setFtsResults(results);
      } catch { /* search failed, ignore */ }
    }, 200);
    return () => clearTimeout(timer);
  }, [globalSearch, isIndexed]);

  return useMemo(() => ({
    globalSearch, setGlobalSearch,
    quickQuery, setQuickQuery,
    ftsResults,
    tagEntries, setTagEntries,
    isIndexed, setIsIndexed,
    visibleEntries,
    quickResults,
  }), [ftsResults, globalSearch, isIndexed, quickQuery, quickResults, tagEntries, visibleEntries]);
}
