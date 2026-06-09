import type { NoteEntry, Preview } from "../types";
import type { Messages } from "../i18n";
import { IMAGE_EXTENSIONS } from "../constants";

export async function buildBinaryPreview(entry: NoteEntry, bytes: number[], t: Messages): Promise<Preview> {
  const array = new Uint8Array(bytes);

  if (entry.extension === "pdf") {
    return { type: "pdf", url: URL.createObjectURL(new Blob([array], { type: "application/pdf" })) };
  }

  if (IMAGE_EXTENSIONS.has(entry.extension)) {
    return { type: "image", url: URL.createObjectURL(new Blob([array])) };
  }

  return { type: "unsupported", message: t.unsupportedPreview };
}
