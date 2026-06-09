import { useState } from "react";
import type { Preview } from "../types";

export function BinaryPreview({ preview }: { preview: Preview }) {
  const [activeSheet, setActiveSheet] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  if (preview.type === "pdf") return <iframe className="pdf-preview" src={preview.url} title="PDF" />;
  if (preview.type === "image") return <img className="image-preview" src={preview.url} alt="Preview" />;
  if (preview.type === "sheet") return (
    <div className="sheet-preview">
      {preview.sheets.length > 1 && (
        <div className="sheet-tabs">{preview.sheets.map((s, i) => <button key={s.name} className={i === activeSheet ? "active" : ""} onClick={() => setActiveSheet(i)}>{s.name}</button>)}</div>
      )}
      <div className="sheet-scroll"><table>
        {preview.sheets[activeSheet]?.rows.length > 0 && <thead><tr>{preview.sheets[activeSheet].rows[0].map((c, i) => <th key={i}>{c || "\u00A0"}</th>)}</tr></thead>}
        <tbody>{preview.sheets[activeSheet]?.rows.slice(1).map((r, ri) => <tr key={ri} className={ri % 2 === 0 ? "even" : "odd"}>{r.map((c, ci) => <td key={ci}>{c}</td>)}</tr>)}</tbody>
      </table></div>
    </div>
  );
  if (preview.type === "document") return <pre className="document-preview">{preview.text}</pre>;
  if (preview.type === "slides") return (
    <div className="slides-viewer">
      <div className="slides-sidebar">{preview.slides.map((s, i) => {
        const plain = s.replace(/<[^>]+>/g, ""); const desc = plain.length > 40 ? plain.slice(0, 40) + "\u2026" : plain;
        return <button key={i} className={`slide-thumb ${i === activeSlide ? "active" : ""}`} onClick={() => setActiveSlide(i)}><span className="slide-num-badge">{i + 1}</span><div className="slide-preview-box"><span className="slide-desc">{desc}</span></div></button>;
      })}</div>
      <div className="slides-content">{preview.slides[activeSlide] || ""}</div>
    </div>
  );
  return <div className="empty-state">{preview.type === "unsupported" ? preview.message : ""}</div>;
}
