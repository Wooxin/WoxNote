import { useCallback, useEffect, useState } from "react";
import type { NoteEntry } from "../types";
import { appInvoke } from "../bridge";
import { titleFromPath } from "../utils/helpers";

export function useVaultLinks(
  selectedPath: string,
  isIndexed: boolean,
  notes: NoteEntry[],
  handleSelectFile: (entry: NoteEntry) => Promise<void>,
  statusSetter: (msg: string) => void,
  refreshKey: number,
) {
  const [backlinkPaths, setBacklinkPaths] = useState<string[]>([]);
  const [forwardLinks, setForwardLinks] = useState<string[]>([]);

  // Fetch backlinks / forward links when selection changes
  useEffect(() => {
    if (!selectedPath || !isIndexed) {
      setBacklinkPaths([]);
      setForwardLinks([]);
      return;
    }
    void (async () => {
      try {
        const [bl, fl] = await Promise.all([
          appInvoke<string[]>("get_backlinks_for", { path: selectedPath }),
          appInvoke<string[]>("get_forward_links_for", { path: selectedPath }),
        ]);
        setBacklinkPaths(bl);
        setForwardLinks(fl);
      } catch { /* ignore */ }
    })();
  }, [selectedPath, isIndexed, refreshKey]);

  // Navigate to note by title (wiki link click)
  const openLinkByTitle = useCallback((title: string) => {
    const normalized = title.toLowerCase();
    const target = notes.find((entry) => titleFromPath(entry.path).toLowerCase() === normalized);
    if (target) {
      void handleSelectFile(target);
      return;
    }
    statusSetter(`[[${title}]] not found`);
  }, [handleSelectFile, notes, statusSetter]);

  return {
    backlinkPaths,
    forwardLinks,
    openLinkByTitle,
  };
}
