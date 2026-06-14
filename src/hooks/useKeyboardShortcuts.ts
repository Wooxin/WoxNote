import { useEffect } from "react";

type ShortcutActions = {
  enableKeyboardShortcuts: boolean;
  saveCurrent: () => Promise<void>;
  createNote: () => Promise<void>;
  openPalette: () => void;
  closeCurrentTab: () => void;
  goBack: () => void;
  goForward: () => void;
  shortcutSave: string;
  shortcutPalette: string;
  shortcutNewNote: string;
  shortcutCloseTab: string;
};

type ParsedShortcut = {
  ctrlOrMeta: boolean;
  alt: boolean;
  shift: boolean;
  key: string;
};

function parseShortcut(s: string): ParsedShortcut | null {
  const parts = s
    .split("+")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  const key = parts.pop() || "";
  if (!key) return null;
  return {
    ctrlOrMeta: parts.some((part) => part === "ctrl" || part === "cmd" || part === "meta" || part === "mod"),
    alt: parts.some((part) => part === "alt" || part === "option"),
    shift: parts.some((part) => part === "shift"),
    key,
  };
}

export function useKeyboardShortcuts({
  enableKeyboardShortcuts,
  saveCurrent,
  createNote,
  openPalette,
  closeCurrentTab,
  goBack,
  goForward,
  shortcutSave,
  shortcutPalette,
  shortcutNewNote,
  shortcutCloseTab,
}: ShortcutActions) {
  useEffect(() => {
    const shortcuts = [
      { def: shortcutSave, action: saveCurrent },
      { def: shortcutPalette, action: openPalette },
      { def: shortcutNewNote, action: createNote },
      { def: shortcutCloseTab, action: closeCurrentTab },
      { def: "Alt+ArrowLeft", action: goBack },
      { def: "Alt+ArrowRight", action: goForward },
    ].flatMap((s) => {
      const parsed = parseShortcut(s.def);
      return parsed ? [{ ...parsed, action: s.action }] : [];
    });

    function handleKeydown(event: KeyboardEvent) {
      if (!enableKeyboardShortcuts) return;
      const ctrlOrMeta = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      for (const sc of shortcuts) {
        if (
          sc.ctrlOrMeta === ctrlOrMeta &&
          sc.alt === event.altKey &&
          sc.shift === event.shiftKey &&
          sc.key === key
        ) {
          event.preventDefault();
          sc.action();
          return;
        }
      }
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [enableKeyboardShortcuts, saveCurrent, createNote, openPalette, closeCurrentTab, goBack, goForward, shortcutSave, shortcutPalette, shortcutNewNote, shortcutCloseTab]);
}
