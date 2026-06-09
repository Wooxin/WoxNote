import { Command } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useVaultContext } from "../contexts/VaultContext";
import { iconForEntry } from "../utils/helpers";

export function CommandPalette() {
  const app = useAppContext();
  const vault = useVaultContext();

  return (
    <div className="palette-backdrop" onMouseDown={() => vault.setIsPaletteOpen(false)}>
      <section className="command-palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="palette-input">
          <Command size={18} />
          <input
            autoFocus
            value={vault.quickQuery}
            onChange={(event) => vault.setQuickQuery(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") vault.setIsPaletteOpen(false);
              if (event.key === "Enter" && vault.quickResults[0]) void vault.handleSelectFile(vault.quickResults[0]);
            }}
            placeholder={app.t.commandPlaceholder}
          />
        </div>
        <div className="palette-results">
          {vault.quickResults.map((entry) => (
            <button key={entry.path} onClick={() => void vault.handleSelectFile(entry)}>
              {iconForEntry(entry)}
              <span>{entry.path}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}