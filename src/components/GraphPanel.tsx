import { ArrowLeft, ExternalLink, Link2, Network } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useVaultContext } from "../contexts/VaultContext";
import { titleFromPath } from "../utils/helpers";

type GraphNode = {
  id: string;
  label: string;
  kind: "current" | "backlink" | "outlink" | "mention";
  x: number;
  y: number;
  open: () => void;
};

function wikiTarget(link: string) {
  return link.split("|")[0].split("#")[0].trim();
}

function nodeColor(kind: GraphNode["kind"]) {
  if (kind === "current") return "#88c0d0";
  if (kind === "backlink") return "#a3be8c";
  if (kind === "outlink") return "#ebcb8b";
  return "#b48ead";
}

export function GraphPanel() {
  const app = useAppContext();
  const vault = useVaultContext();
  const current = vault.selectedEntry;

  if (!current) {
    return (
      <section className="graph-panel">
        <div className="graph-empty">
          <Network size={36} />
          <span>{app.t.graphNoNote}</span>
        </div>
      </section>
    );
  }

  const center: GraphNode = {
    id: current.path,
    label: titleFromPath(current.path),
    kind: "current",
    x: 400,
    y: 230,
    open: () => vault.setIsGraphOpen(false),
  };

  const related: GraphNode[] = [
    ...vault.backlinks.slice(0, 10).map((backlink) => ({
      id: `backlink:${backlink.path}:${backlink.line}`,
      label: titleFromPath(backlink.path),
      kind: "backlink" as const,
      open: () => void vault.openBacklink(backlink),
    })),
    ...vault.links.slice(0, 10).map((link) => ({
      id: `outlink:${link}`,
      label: wikiTarget(link) || link,
      kind: "outlink" as const,
      open: () => vault.openLinkByTitle(link),
    })),
    ...vault.unlinkedMentions.slice(0, 8).map((mention) => ({
      id: `mention:${mention.path}:${mention.line}`,
      label: titleFromPath(mention.path),
      kind: "mention" as const,
      open: () => void vault.openMention(mention),
    })),
  ].map((node, index, list) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, list.length) - Math.PI / 2;
    const radius = list.length > 12 ? 178 : 155;
    return {
      ...node,
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  });

  const nodes = [center, ...related];

  return (
    <section className="graph-panel">
      <header className="graph-header">
        <div>
          <h2>{app.t.localGraph}</h2>
          <p>{app.t.graphHint}</p>
        </div>
        <button onClick={() => vault.setIsGraphOpen(false)}>
          <ArrowLeft size={16} />
          <span>{current.name}</span>
        </button>
      </header>

      <div className="graph-summary">
        <span><Link2 size={14} />{app.t.graphBacklinks}: {vault.backlinks.length}</span>
        <span><ExternalLink size={14} />{app.t.graphOutLinks}: {vault.links.length}</span>
        <span><Network size={14} />{app.t.graphMentions}: {vault.unlinkedMentions.length}</span>
      </div>

      <div className="graph-canvas" role="img" aria-label={app.t.localGraph}>
        <svg viewBox="0 0 800 460">
          {related.map((node) => (
            <line key={`edge:${node.id}`} x1={center.x} y1={center.y} x2={node.x} y2={node.y} className={`graph-edge ${node.kind}`} />
          ))}
          {nodes.map((node) => (
            <g key={node.id} className={`graph-node ${node.kind}`} onClick={node.open} tabIndex={0} onKeyDown={(event) => { if (event.key === "Enter") node.open(); }}>
              <circle cx={node.x} cy={node.y} r={node.kind === "current" ? 30 : 22} fill={nodeColor(node.kind)} />
              <text x={node.x} y={node.y + (node.kind === "current" ? 46 : 38)} textAnchor="middle">{node.label}</text>
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
