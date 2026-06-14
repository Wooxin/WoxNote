import { useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { FileArchive, FileText, Link, List, Rows3, SquarePen } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useVaultContext } from "../contexts/VaultContext";
import { titleFromPath } from "../utils/helpers";
import { appInvoke } from "../bridge";
import { scrollToHeading } from "./CMLivePreview";

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
type PropertyValue = string | string[] | number | boolean;
type PropertyEntry = { key: string; value: PropertyValue };

function extractToc(content: string): TocItem[] {
  // Strip fenced code blocks so #comments in code aren't treated as headings
  const clean = content.replace(/```[\s\S]*?```/g, "");
  const items: TocItem[] = [];
  const re = /^(#{1,3})\s+(.+)$/gm;
  let match;
  while ((match = re.exec(clean)) !== null) {
    items.push({ level: match[1].length, text: match[2].trim() });
  }
  return items;
}

function wikiTarget(link: string) {
  return link.split("|")[0].split("#")[0].trim().toLowerCase();
}

function stripYamlQuotes(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseScalar(value: string): PropertyValue {
  const clean = stripYamlQuotes(value);
  if (/^(true|false)$/i.test(clean)) return clean.toLowerCase() === "true";
  if (/^-?\d+(?:\.\d+)?$/.test(clean)) return Number(clean);
  return clean;
}

function parseInlineArray(value: string) {
  const inner = value.trim().slice(1, -1);
  if (!inner.trim()) return [];
  return inner.split(",").map((item) => stripYamlQuotes(item).trim()).filter(Boolean);
}

function extractProperties(content: string): PropertyEntry[] {
  if (!content.startsWith("---")) return [];
  const end = content.indexOf("\n---", 3);
  if (end < 0) return [];
  const lines = content.slice(3, end).split(/\r?\n/);
  const entries: PropertyEntry[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const raw = match[2].trim();
    if (!raw) {
      const values: string[] = [];
      while (index + 1 < lines.length) {
        const next = lines[index + 1].match(/^\s*-\s+(.+)$/);
        if (!next) break;
        values.push(stripYamlQuotes(next[1]));
        index += 1;
      }
      entries.push({ key, value: values });
      continue;
    }
    entries.push({ key, value: raw.startsWith("[") && raw.endsWith("]") ? parseInlineArray(raw) : parseScalar(raw) });
  }

  return entries;
}

function displayPropertyValue(value: PropertyValue) {
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

function propertySearchQuery(key: string, value: string) {
  const cleanValue = value.replace(/^#/, "").trim();
  return key.toLowerCase() === "tags" ? `tag:${cleanValue}` : `${key}:${cleanValue}`;
}

function parentPath(path: string) {
  return path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : path;
}



type Props = Record<string, never>;

export function ContextSidebar(_props: Props) {
  const app = useAppContext();
  const vault = useVaultContext();

  const handleOpenInSystem = () => {
    if (!vault.selectedEntry) return;
    const basePath = (app.activeVault + "\\" + vault.selectedEntry.path).replace(/\//g, "\\");
    const targetPath = vault.selectedEntry.isDir ? basePath : basePath.substring(0, basePath.lastIndexOf("\\"));
    void appInvoke("open_in_explorer", { path: targetPath });
  };
  const toc = useMemo(() => extractToc(vault.content), [vault.content]);
  const properties = useMemo(() => extractProperties(vault.content), [vault.content]);
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
              onClick={() => scrollToHeading(item.text)}>{item.text}</button>
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
            <span>{app.t.path}</span>
            <button className="file-info-filter" onClick={() => vault.setGlobalSearch(`path:${parentPath(vault.selectedEntry!.path)}`)}>
              {parentPath(vault.selectedEntry.path)}
            </button>
            {vault.selectedEntry.modified > 0 && <><span>{app.t.modifiedTime}</span><span>{formatTime(vault.selectedEntry.modified)}</span></>}
          </div>
        </section>
      )}

      {properties.length > 0 && (
        <section className="context-section">
          <div className="context-title"><Rows3 size={16} /><span>{app.t.properties}</span></div>
          <div className="property-list">
            {properties.slice(0, 16).map((property) => (
              <div key={property.key} className="property-row">
                <span className="property-key">{property.key}</span>
                {Array.isArray(property.value) ? (
                  <div className="property-values">
                    {property.value.slice(0, 10).map((item) => {
                      return (
                        <button key={item} className="property-chip" onClick={() => vault.setGlobalSearch(propertySearchQuery(property.key, item))}>
                          {item}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <button className="property-value property-value-button" onClick={() => vault.setGlobalSearch(propertySearchQuery(property.key, displayPropertyValue(property.value)))}>
                    {displayPropertyValue(property.value)}
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="context-section">
        <div className="context-title"><Link size={16} /><span>{app.t.backlinks}</span></div>
        {vault.backlinks.length === 0 ? <p className="muted">{app.t.noBacklinks}</p> : vault.backlinks.slice(0, 8).map((backlink) => (
          <button key={`${backlink.path}:${backlink.line}`} className="backlink-item" onClick={() => void vault.openBacklink(backlink)}>
            <span>{titleFromPath(backlink.path)}</span>
            <small>{app.t.line} {backlink.line} · {backlink.snippet || backlink.path}</small>
          </button>
        ))}
      </section>

      <section className="context-section">
        <div className="context-title"><Link size={16} /><span>{app.t.unlinkedMentions}</span></div>
        {vault.unlinkedMentions.length === 0 ? <p className="muted">{app.t.noUnlinkedMentions}</p> : vault.unlinkedMentions.slice(0, 8).map((mention) => (
          <div key={`${mention.path}:${mention.line}`} className="mention-row">
            <button className="backlink-item" onClick={() => void vault.openMention(mention)}>
              <span>{titleFromPath(mention.path)}</span>
              <small>{app.t.line} {mention.line} · {mention.snippet || mention.path}</small>
            </button>
            <button className="mention-link-action" title={app.t.linkMention} onClick={() => void vault.linkMention(mention)}>
              <SquarePen size={14} />
            </button>
          </div>
        ))}
      </section>

      <section className="context-section">
        <div className="context-title"><Link size={16} /><span>{app.t.outLinks}</span></div>
        {vault.links.length === 0 ? <p className="muted">{app.t.noLinks}</p> : vault.links.slice(0, 5).map((link) => {
          const exists = vault.notes.some((entry) => titleFromPath(entry.path).toLowerCase() === wikiTarget(link));
          return (
            <button key={link} className={exists ? "" : "unresolved-link"} onClick={() => vault.openLinkByTitle(link)}>
              <span>[[{link}]]</span>
              {!exists && <small>{app.t.newNote}</small>}
            </button>
          );
        })}
      </section>

      {vault.selectedEntry && (
        <button className="system-open" onClick={handleOpenInSystem}>
          <FileArchive size={16} />
          <span>{app.t.openInSystem}</span>
        </button>
      )}
    </aside>
  );
}
