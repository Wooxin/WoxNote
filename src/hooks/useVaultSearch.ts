import { useEffect, useMemo, useState } from "react";
import type { NoteEntry } from "../types";
import { appInvoke } from "../bridge";

type SearchResult = { path: string; title: string; snippet: string; line: number; score: number };
type TagEntry = { name: string; count: number };
type ParsedSearch = { text: string; path: string; tags: string[]; props: Record<string, string> };

function parseSearchQuery(query: string): ParsedSearch {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  const text: string[] = [];
  const tags: string[] = [];
  const props: Record<string, string> = {};
  let path = "";

  for (const token of tokens) {
    const match = token.match(/^([A-Za-z0-9_-]+):(.+)$/);
    if (!match) {
      text.push(token);
      continue;
    }
    const key = match[1].toLowerCase();
    const value = match[2].trim().toLowerCase();
    if (!value) continue;
    if (key === "path") path = value;
    else if (key === "tag" || key === "tags") tags.push(value.replace(/^#/, ""));
    else props[key] = value;
  }

  return { text: text.join(" "), path, tags, props };
}

function stripYamlQuotes(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(content: string) {
  const props: Record<string, string[]> = {};
  if (!content.startsWith("---")) return props;
  const end = content.indexOf("\n---", 3);
  if (end < 0) return props;
  const lines = content.slice(3, end).split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const raw = match[2].trim();
    if (raw.startsWith("[") && raw.endsWith("]")) {
      props[key] = raw.slice(1, -1).split(",").map((item) => stripYamlQuotes(item).trim()).filter(Boolean);
      continue;
    }
    if (raw) {
      props[key] = [stripYamlQuotes(raw)];
      continue;
    }
    const values: string[] = [];
    while (index + 1 < lines.length) {
      const next = lines[index + 1].match(/^\s*-\s+(.+)$/);
      if (!next) break;
      values.push(stripYamlQuotes(next[1]));
      index += 1;
    }
    props[key] = values;
  }

  return props;
}

function contentTags(content: string) {
  const frontmatter = parseFrontmatter(content);
  const frontmatterTags = (frontmatter.tags ?? []).map((tag) => tag.replace(/^#/, ""));
  const inlineTags = Array.from(content.matchAll(/(?:^|\s)#([A-Za-z0-9_\u4e00-\u9fff]+)/gu)).map((match) => match[1]);
  return [...frontmatterTags, ...inlineTags].map((tag) => tag.toLowerCase());
}

function matchesMetadata(content: string, parsed: ParsedSearch) {
  if (parsed.tags.length === 0 && Object.keys(parsed.props).length === 0) return true;
  const props = parseFrontmatter(content);
  const tags = contentTags(content);
  if (parsed.tags.some((tag) => !tags.includes(tag))) return false;
  return Object.entries(parsed.props).every(([key, value]) => {
    const values = (props[key] ?? []).map((item) => item.toLowerCase());
    return values.some((item) => item === value || item.includes(value));
  });
}

export function useVaultSearch(
  vaultPath: string,
  entries: NoteEntry[],
  files: NoteEntry[],
  collapsedDirs: Set<string>,
) {
  const [globalSearch, setGlobalSearch] = useState("");
  const [quickQuery, setQuickQuery] = useState("");
  const [ftsResults, setFtsResults] = useState<SearchResult[]>([]);
  const [tagEntries, setTagEntries] = useState<TagEntry[]>([]);
  const [isIndexed, setIsIndexed] = useState(false);
  const [filteredPaths, setFilteredPaths] = useState<Set<string> | null>(null);
  const parsedGlobalSearch = useMemo(() => parseSearchQuery(globalSearch), [globalSearch]);
  const hasMetadataFilters = parsedGlobalSearch.tags.length > 0 || Object.keys(parsedGlobalSearch.props).length > 0;

  useEffect(() => {
    if (!vaultPath || !hasMetadataFilters) {
      setFilteredPaths(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const matches = new Set<string>();
        await Promise.all(files.slice(0, 600).map(async (file) => {
          try {
            const content = await appInvoke<string>("read_text_file", { root: vaultPath, relativePath: file.path });
            if (matchesMetadata(content, parsedGlobalSearch)) matches.add(file.path);
          } catch { /* ignore unreadable file */ }
        }));
        if (!cancelled) setFilteredPaths(matches);
      })();
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [files, hasMetadataFilters, parsedGlobalSearch, vaultPath]);

  // Derived: visible entries filtered by search + collapsed dirs
  const visibleEntries = useMemo(() => {
    const query = parsedGlobalSearch.text.toLowerCase();
    const pathFilter = parsedGlobalSearch.path;
    if (globalSearch.trim()) {
      return entries.filter((entry) => {
        if (filteredPaths && !entry.isDir && !filteredPaths.has(entry.path)) return false;
        if (pathFilter && !entry.path.toLowerCase().includes(pathFilter)) return false;
        if (query && !entry.path.toLowerCase().includes(query)) return false;
        return true;
      });
    }

    const result = entries;
    return result.filter((entry) => {
      const parts = entry.path.split("/");
      for (let i = 0; i < parts.length - 1; i++) {
        if (collapsedDirs.has(parts.slice(0, i + 1).join("/"))) return false;
      }
      return true;
    });
  }, [entries, globalSearch, collapsedDirs, filteredPaths, parsedGlobalSearch]);

  const quickResults = useMemo(() => {
    const normalized = quickQuery.trim().toLowerCase();
    const source = normalized
      ? files.filter((entry) => entry.path.toLowerCase().includes(normalized))
      : files;
    return source.slice(0, 12);
  }, [files, quickQuery]);

  // FTS search (debounced)
  useEffect(() => {
    const searchText = parsedGlobalSearch.text.trim();
    if (!isIndexed || !searchText) {
      setFtsResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await appInvoke<SearchResult[]>("search_vault", { query: searchText });
        setFtsResults(results.filter((result) => (
          (!parsedGlobalSearch.path || result.path.toLowerCase().includes(parsedGlobalSearch.path))
          && (!filteredPaths || filteredPaths.has(result.path))
        )));
      } catch { /* search failed, ignore */ }
    }, 200);
    return () => clearTimeout(timer);
  }, [filteredPaths, isIndexed, parsedGlobalSearch]);

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
