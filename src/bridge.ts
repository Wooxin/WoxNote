import { invoke, isTauri } from "@tauri-apps/api/core";
import { mockStore, createMockEntries } from "./mocks/bridge-mock";

const isDesktop = isTauri();

let mockEntries = createMockEntries();

export async function appInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isDesktop) {
    return invoke<T>(command, args);
  }

  switch (command) {
    case "startup_info": return { defaultPath: "", appDataPath: "", suggestions: [] } as T;
    case "get_user_settings": return { vaultsJson: "[]", activeVault: "", theme: "dark", language: "zh", sidebarCollapsed: false, contentWidth: "900", uiFontSize: "14", contentFontSize: "15", shortcutPalette: "Ctrl+P", shortcutNewNote: "Ctrl+N", shortcutSave: "Ctrl+S", shortcutCloseTab: "Ctrl+W", uiFont: "HarmonyOS Sans", codeFont: "Cascadia Code", collapsedDirsJson: "[]" } as T;
    case "save_user_settings": case "ensure_vault": case "reindex_vault": case "start_watching_vault": case "stop_watching_vault": case "index_file": case "restore_version": return undefined as T;
    case "list_entries": return [...mockEntries] as T;
    case "read_text_file": return (mockStore[String(args?.relativePath ?? "")] ?? "") as T;
    case "write_text_file": { mockStore[String(args?.relativePath ?? "")] = String(args?.content ?? ""); return undefined as T; }
    case "create_note": { const title = String(args?.title ?? "Untitled").trim() || "Untitled"; const path = title + ".md"; mockStore[path] = "# " + title + "\n\n"; mockEntries = [{ name: title + ".md", path, extension: "md", isDir: false, size: 10, modified: Date.now() / 1000 }, ...mockEntries]; return path as T; }
    case "create_note_in_dir": { const dir = String(args?.dir ?? ""); const title = String(args?.title ?? "Untitled").trim() || "Untitled"; const path = dir ? dir + "/" + title + ".md" : title + ".md"; mockStore[path] = "# " + title + "\n\n"; mockEntries = [{ name: title + ".md", path, extension: "md", isDir: false, size: 10, modified: Date.now() / 1000 }, ...mockEntries]; return path as T; }
    case "create_folder": {
      const dir = String(args?.dir ?? "");
      const title = String(args?.title ?? "New Folder").trim() || "New Folder";
      const base = dir ? dir + "/" + title : title;
      let path = base;
      let index = 2;
      while (mockEntries.some(e => e.path === path)) path = `${base} ${index++}`;
      mockEntries = [{ name: path.split("/").pop() ?? path, path, extension: "", isDir: true, size: 0, modified: Date.now() / 1000 }, ...mockEntries];
      return path as T;
    }
    case "delete_entry": {
      const path = String(args?.relativePath ?? args?.path ?? "");
      mockEntries = mockEntries.filter(e => e.path !== path && !e.path.startsWith(path + "/"));
      delete mockStore[path];
      return undefined as T;
    }
    case "search_vault": { const q = String(args?.query ?? "").toLowerCase(); return Object.entries(mockStore).filter(([,c]) => c.toLowerCase().includes(q)).map(([p,c]) => ({ path: p, title: p.replace(/\.md$/,""), snippet: c.slice(0,100), score: 1 })) as T; }
    case "get_backlinks_for": case "get_forward_links_for": return [] as T;
    case "get_all_tags": return [] as T;
    case "preview_binary": return { type: "unsupported", sheets: [], text: "", slides: [], message: "" } as T;
    case "rename_entry": {
      const old = String(args?.oldPath ?? "");
      const rawName = String(args?.newName ?? "").trim();
      const idx = mockEntries.findIndex(e => e.path === old);
      if (idx < 0 || !rawName) return old as T;
      const entry = mockEntries[idx];
      const dir = old.includes("/") ? old.slice(0, old.lastIndexOf("/") + 1) : "";
      const oldExt = !entry.isDir && old.includes(".") ? old.slice(old.lastIndexOf(".") + 1) : "";
      const hasExt = /\.[^./\\]+$/.test(rawName);
      const fileName = oldExt && !hasExt ? `${rawName}.${oldExt}` : rawName;
      const nextPath = dir + fileName;
      mockEntries = mockEntries.map(e => {
        if (e.path === old) return { ...e, name: fileName, path: nextPath, extension: entry.isDir ? "" : (fileName.split(".").pop() ?? "") };
        if (entry.isDir && e.path.startsWith(old + "/")) return { ...e, path: nextPath + e.path.slice(old.length) };
        return e;
      });
      if (mockStore[old] !== undefined) {
        mockStore[nextPath] = mockStore[old];
        delete mockStore[old];
      }
      return nextPath as T;
    }
    case "paste_image": { const name = "image_" + Date.now() + ".png"; mockStore[name] = "[binary]"; return name as T; }
    case "count_words": { const text = String(args?.content ?? ""); const cjk = (text.match(/[\u4e00-\u9fff]/g) || []).length; const eng = (text.match(/[a-zA-Z0-9]+/g) || []).length; return (cjk + eng) as T; }
    case "extract_toc_rust": { const items: { level: number; text: string }[] = []; const clean = String(args?.content ?? "").replace(/```[\s\S]*?```/g, ""); const re = /^(#{1,3})\s+(.+)$/gm; let m; while ((m = re.exec(clean)) !== null) items.push({ level: m[1].length, text: m[2].trim() }); return items as T; }
    case "export_note_html": return "<html><body><h1>Mock</h1></body></html>" as T;
    case "list_versions": return [] as T;
    case "fuzzy_match_titles": { const q = String(args?.query ?? "").toLowerCase(); const titles = Object.keys(mockStore).filter(k => k.endsWith('.md')).map(k => k.replace(/\.md$/, '')).filter(t => t.toLowerCase().includes(q)).slice(0, 20).map(t => ({ title: t, path: t + '.md', score: t.toLowerCase().startsWith(q) ? 100 : 50 })); return titles as T; }
    case "rename_note_with_links": {
      const old = String(args?.oldRelative ?? "");
      const rawName = String(args?.newName ?? "").trim();
      const idx = mockEntries.findIndex(e => e.path === old);
      if (idx < 0 || !rawName) return old as T;
      const entry = mockEntries[idx];
      const ext = entry.extension || "md";
      const suffix = "." + ext;
      const title = rawName.toLowerCase().endsWith(suffix) ? rawName.slice(0, -suffix.length) : rawName;
      const dir = old.includes("/") ? old.slice(0, old.lastIndexOf("/") + 1) : "";
      const nextPath = `${dir}${title}.${ext}`;
      const oldTitle = old.split("/").pop()?.replace(/\.(md|markdown|novel)$/i, "") ?? old;
      mockEntries[idx] = { ...entry, name: `${title}.${ext}`, path: nextPath };
      if (mockStore[old] !== undefined) {
        mockStore[nextPath] = mockStore[old];
        delete mockStore[old];
      }
      for (const [path, content] of Object.entries(mockStore)) {
        mockStore[path] = content.replace(new RegExp(`\\[\\[${oldTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}((?:#[^|\\]]*)?(?:\\|[^\\]]*)?)\\]\\]`, "gi"), `[[${title}$1]]`);
      }
      return nextPath as T;
    }
    default: throw new Error("Unknown mock command: " + command);
  }
}
