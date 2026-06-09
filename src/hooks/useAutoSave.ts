import { useEffect, useRef } from "react";
import type { NoteEntry } from "../types";

/** Debounced auto-save: saves 2 seconds after last edit. */
export function useAutoSave(
  isDirty: boolean,
  content: string,
  selectedEntry: NoteEntry | undefined,
  saveCurrent: () => Promise<void>,
) {
  const autoSaveRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!isDirty || !selectedEntry) return;
    clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      void saveCurrent();
    }, 2000);
    return () => clearTimeout(autoSaveRef.current);
  }, [isDirty, content, selectedEntry, saveCurrent]);
}