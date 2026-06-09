import type { NoteEntry, VaultSuggestion } from "../types";
import type { Messages } from "../i18n";
import { IMAGE_EXTENSIONS } from "../constants";
import { File, FileImage, FileSpreadsheet, FileText, Folder } from "lucide-react";

export function titleFromPath(path: string) {
  const file = path.split("/").pop() ?? "";
  return file.replace(/\.(md|markdown)$/i, "");
}

export function escapeHtml(source: string) {
  return source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function escapeAttribute(source: string) {
  return escapeHtml(source).replace(/`/g, "&#096;");
}

export function suggestionName(item: VaultSuggestion, t: Messages) {
  if (item.name.includes("OneDrive")) {
    return t.oneDrivePersonal;
  }
  if (item.name.includes("Local")) {
    return t.localDocuments;
  }
  if (item.name.includes("App Workspace")) {
    return t.appWorkspace;
  }
  return item.name;
}

export function iconForEntry(entry: NoteEntry) {
  if (entry.isDir) {
    return <Folder size={17} />;
  }
  if (entry.extension === "xlsx" || entry.extension === "xls") {
    return <FileSpreadsheet size={17} />;
  }
  if (entry.extension === "docx" || entry.extension === "pdf" || entry.extension === "pptx") {
    return <FileText size={17} />;
  }
  if (IMAGE_EXTENSIONS.has(entry.extension)) {
    return <FileImage size={17} />;
  }
  return <File size={17} />;
}
