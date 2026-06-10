import type { NoteEntry } from "../types";
import { IMAGE_EXTENSIONS } from "../constants";
import { File, FileImage, FileSpreadsheet, FileText, Folder } from "lucide-react";

export function titleFromPath(path: string) {
  const file = path.split("/").pop() ?? "";
  return file.replace(/\.(md|markdown)$/i, "");
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
