import { useAppContext } from "../contexts/AppContext";
import { useVaultContext } from "../contexts/VaultContext";

type Props = {
  wordCount: number;
  charCount: number;
  cursorLine: number;
  cursorCol: number;
  noteName: string;
};

export function StatusBar({ wordCount: wc, charCount, cursorLine, cursorCol, noteName }: Props) {
  const app = useAppContext();
  const vault = useVaultContext();

  const words = wc;

  return (
    <div className="status-bar">
      <div className="status-bar-left">
        {vault.selectedEntry && (
          <span className="status-item">{noteName}</span>
        )}
        <span className="status-item">{words} {app.t.words || "words"}</span>
        <span className="status-item">{charCount} {"chars"}</span>
      </div>
      <div className="status-bar-right">
        <span className="status-item">Ln {cursorLine}, Col {cursorCol}</span>
        <span className="status-item">{vault.openTabs.length} {"tabs"}</span>
      </div>
    </div>
  );
}
