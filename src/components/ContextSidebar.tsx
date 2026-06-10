import { useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { FileArchive, FileText, Link, List } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useVaultContext } from "../contexts/VaultContext";
import { titleFromPath } from "../utils/helpers";
import { appInvoke } from "../bridge";

function wordCount(text: string): number {
  const chinese = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const english = (text.match(/[a-zA-Z]+/g) || []).length;
  return chinese + english;
}

function readingTime(words: number): string {
  const minutes = Math.max(1, Math.ceil(words / 300));
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

type TocItem = { level: number; text: string };

function extractToc(content: string): TocItem[] {
  const items: TocItem[] = [];
  const re = /^(#{1,3})\s+(.+)$/gm;
  let match;
  while ((match = re.exec(content)) !== null) {
    items.push({ level: match[1].length, text: match[2].trim() });
  }
  return items;
}



type Props = {
  onOpenInSystem: (path: string) => void;
};

export function ContextSidebar({ onOpenInSystem }: Props) {
  const app = useAppContext();
  const vault = useVaultContext();
  const toc = useMemo(() => extractToc(vault.content), [vault.content]);
  const [rustToc, setRustToc] = useState<TocItem[] | null>(null);

  useEffect(() => {
    setRustToc(null);
    if (!isTauri() || !vault.content) return;
    appInvoke<TocItem[]>("extract_toc_rust", { content: vault.content })
      .then(setRustToc)
      .catch(() => setRustToc(null));
  }, [vault.content]);

  const displayToc = rustToc ?? toc;

  return (
    <aside className="context-sidebar">
      {displayToc.length > 0 && (
        <section className="context-section">
          <div className="context-title"><List size={16} /><span>{app.t.toc}</span></div>
          {displayToc.slice(0, 12).map((item, i) => (
            <button key={i} className="toc-item"
              style={{ paddingLeft: `${8 + (item.level - 1) * 12}px` }}
              onClick={() => vault.scrollToHeading?.(item.text)}>{item.text}</button>
          ))}
        </section>
      )}

      {vault.selectedEntry && (
        <section className="context-section">
          <div className="context-title"><FileText size={16} /><span>{vault.selectedEntry.isDir ? app.t.folderInfo : app.t.fileInfo}</span></div>
          <div className="file-info">
            <span>{app.t.words}</span><span>{wordCount(vault.content)}</span>
            <span>{app.t.reading}</span><span>{readingTime(wordCount(vault.content))}</span>
            <span>{app.t.size}</span><span>{formatSize(vault.selectedEntry.size)}</span>
            {vault.selectedEntry.modified > 0 && <><span>{app.t.modifiedTime}</span><span>{formatTime(vault.selectedEntry.modified)}</span></>}
          </div>
        </section>
      )}

      <section className="context-section">
        <div className="context-title"><Link size={16} /><span>{app.t.backlinks}</span></div>
        {vault.backlinks.length === 0 ? <p className="muted">{app.t.noBacklinks}</p> : vault.backlinks.slice(0, 5).map((path) => (
          <button key={path} onClick={() => {
            const entry = vault.entries.find((item) => item.path === path);
            if (entry) void vault.handleSelectFile(entry);
          }}>{titleFromPath(path)}</button>
        ))}
      </section>

      <section className="context-section">
        <div className="context-title"><Link size={16} /><span>{app.t.outLinks}</span></div>
        {vault.links.length === 0 ? <p className="muted">{app.t.noLinks}</p> : vault.links.slice(0, 5).map((link) => (
          <button key={link} onClick={() => vault.openLinkByTitle(link)}>[[{link}]]</button>
        ))}
      </section>

      {vault.selectedEntry && (
        <button className="system-open" onClick={() => onOpenInSystem(`${app.activeVault}\\${vault.selectedEntry!.path.replace(/\//g, "\\")}`)}>
          <FileArchive size={16} />
          <span>{app.t.openInSystem}</span>
        </button>
      )}
    </aside>
  );
}
