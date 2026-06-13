import { useCallback, useEffect, useState } from "react";
import type { BacklinkEntry, MentionEntry, NoteEntry } from "../types";
import { appInvoke } from "../bridge";
import { titleFromPath } from "../utils/helpers";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findBacklinkContext(content: string, targetTitle: string): Pick<BacklinkEntry, "line" | "snippet"> {
  const pattern = new RegExp(`\\[\\[${escapeRegExp(targetTitle)}(?:#[^|\\]]*)?(?:\\|[^\\]]*)?\\]\\]`, "i");
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));
  const line = Math.max(0, index);
  return {
    line: line + 1,
    snippet: (lines[line] ?? "").trim(),
  };
}

function hasWikiLinkTo(line: string, targetTitle: string) {
  const pattern = new RegExp(`\\[\\[${escapeRegExp(targetTitle)}(?:#[^|\\]]*)?(?:\\|[^\\]]*)?\\]\\]`, "i");
  return pattern.test(line);
}

function findUnlinkedMention(content: string, targetTitle: string): Pick<MentionEntry, "line" | "snippet"> | null {
  const needle = targetTitle.trim();
  if (!needle) return null;
  const lines = content.split(/\r?\n/);
  const lowerNeedle = needle.toLowerCase();
  const index = lines.findIndex((line) => (
    line.toLowerCase().includes(lowerNeedle) && !hasWikiLinkTo(line, needle)
  ));
  if (index < 0) return null;
  return {
    line: index + 1,
    snippet: lines[index].trim(),
  };
}

function normalizeWikiTarget(title: string) {
  return title.split("|")[0].split("#")[0].trim();
}

export function useVaultLinks(
  vaultPath: string,
  selectedPath: string,
  isIndexed: boolean,
  notes: NoteEntry[],
  handleSelectFile: (entry: NoteEntry) => Promise<void>,
  createMissingLink: (title: string) => Promise<void>,
  statusSetter: (msg: string) => void,
  refreshKey: number,
) {
  const [backlinks, setBacklinks] = useState<BacklinkEntry[]>([]);
  const [unlinkedMentions, setUnlinkedMentions] = useState<MentionEntry[]>([]);
  const [forwardLinks, setForwardLinks] = useState<string[]>([]);

  // Fetch backlinks / forward links when selection changes
  useEffect(() => {
    if (!selectedPath || !isIndexed) {
      setBacklinks([]);
      setUnlinkedMentions([]);
      setForwardLinks([]);
      return;
    }
    void (async () => {
      try {
        const [bl, fl] = await Promise.all([
          appInvoke<string[]>("get_backlinks_for", { path: selectedPath }),
          appInvoke<string[]>("get_forward_links_for", { path: selectedPath }),
        ]);
        const targetTitle = titleFromPath(selectedPath);
        const nextBacklinks = await Promise.all(bl.map(async (path) => {
          try {
            const content = await appInvoke<string>("read_text_file", { root: vaultPath, relativePath: path });
            const context = findBacklinkContext(content, targetTitle);
            return { path, ...context };
          } catch {
            return { path, line: 1, snippet: "" };
          }
        }));
        const backlinkPathSet = new Set(bl);
        const mentionCandidates = notes
          .filter((note) => note.path !== selectedPath && !backlinkPathSet.has(note.path))
          .slice(0, 300);
        const nextMentions = (await Promise.all(mentionCandidates.map(async (note) => {
          try {
            const content = await appInvoke<string>("read_text_file", { root: vaultPath, relativePath: note.path });
            const mention = findUnlinkedMention(content, targetTitle);
            return mention ? { path: note.path, ...mention } : null;
          } catch {
            return null;
          }
        }))).filter((mention): mention is MentionEntry => Boolean(mention)).slice(0, 20);
        setBacklinks(nextBacklinks);
        setUnlinkedMentions(nextMentions);
        setForwardLinks(fl);
      } catch { /* ignore */ }
    })();
  }, [vaultPath, selectedPath, isIndexed, notes, refreshKey]);

  // Navigate to note by title (wiki link click)
  const openLinkByTitle = useCallback((title: string) => {
    const targetTitle = normalizeWikiTarget(title);
    if (!targetTitle) return;
    const normalized = targetTitle.toLowerCase();
    const target = notes.find((entry) => titleFromPath(entry.path).toLowerCase() === normalized);
    if (target) {
      void handleSelectFile(target);
      return;
    }
    statusSetter(`Creating [[${targetTitle}]]`);
    void createMissingLink(targetTitle);
  }, [createMissingLink, handleSelectFile, notes, statusSetter]);

  return {
    backlinks,
    unlinkedMentions,
    forwardLinks,
    openLinkByTitle,
  };
}
