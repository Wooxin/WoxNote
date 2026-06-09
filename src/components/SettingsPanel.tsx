import React, { useState } from "react";
import { Check, Edit3, Info, Moon, Palette, Settings, Sun, X } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useVaultContext } from "../contexts/VaultContext";

const UI_FONTS = [
  "HarmonyOS Sans", "Inter", "Segoe UI", "SF Pro", "Helvetica Neue", "Roboto",
  "Noto Sans SC", "Microsoft YaHei", "Arial", "Georgia", "system-ui",
];

const CODE_FONTS = [
  "Cascadia Code", "Fira Code", "JetBrains Mono", "Source Code Pro",
  "Consolas", "SF Mono", "Monaco", "Courier New", "monospace",
];

const FONT_SIZES = ["12","13","14","15","16","17","18","20"];
const CONTENT_SIZES = ["13","14","15","16","17","18","20","22"];

type Tab = "general" | "appearance" | "editor" | "about";

type Props = {
  onActivateVault: (path: string) => void;
  onChooseVault: () => void;
};

export function SettingsPanel({ onActivateVault, onChooseVault }: Props) {
  const app = useAppContext();
  const vault = useVaultContext();
  const [tab, setTab] = useState<Tab>("general");

  const tabs: { id: Tab; icon: React.ReactNode; label: string }[] = [
    { id: "general", icon: <Settings size={17} />, label: app.t.settingsSync },
    { id: "appearance", icon: <Palette size={17} />, label: app.t.settingsAppearance },
    { id: "editor", icon: <Edit3 size={17} />, label: app.t.editMode },
    { id: "about", icon: <Info size={17} />, label: "About" },
  ];

  return (
    <div className="settings-backdrop" onMouseDown={() => vault.setIsSettingsOpen(false)}>
      <section className="settings-panel-v2" onMouseDown={(e) => e.stopPropagation()}>
        <aside className="settings-sidebar">
          <div className="settings-sidebar-title">WoxNote</div>
          {tabs.map((item) => (
            <button
              key={item.id}
              className={`settings-tab ${tab === item.id ? "active" : ""}`}
              onClick={() => setTab(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </aside>

        <div className="settings-main">
          <header className="settings-header">
            <h2>{app.t.settings}</h2>
            <button className="icon-button" title={app.t.settingsClose} onClick={() => vault.setIsSettingsOpen(false)}><X size={18} /></button>
          </header>

          <div className="settings-content settings-body">
            {tab === "general" && (
              <section className="settings-section">
                <h3>{app.t.vault}</h3>
                <p className="settings-desc">{app.t.vaultFolderSync}</p>
                <label className="setting-field">
                  <div className="path-row">
                    <input value={app.vaultPath} readOnly spellCheck={false} />
                    <button className="icon-button" title={app.t.openVault} onClick={() => onActivateVault(app.vaultPath)}><Check size={17} /></button>
                    <button className="secondary-action" title={app.t.pickVaultFolder} onClick={onChooseVault}>{app.t.browseVault}</button>
                  </div>
                </label>
              </section>
            )}

            {tab === "appearance" && (
              <>
                <section className="settings-section">
                  <h3>{app.t.theme}</h3>
                  <div className="segmented-control">
                    <button className={app.theme === "dark" ? "active" : ""} onClick={() => app.setTheme("dark")}><Moon size={15} />Dark</button>
                    <button className={app.theme === "light" ? "active" : ""} onClick={() => app.setTheme("light")}><Sun size={15} />Light</button>
                  </div>
                </section>

                <section className="settings-section">
                  <h3>{app.t.language}</h3>
                  <div className="segmented-control">
                    <button className={app.language === "zh" ? "active" : ""} onClick={() => app.setLanguage("zh")}>中文</button>
                    <button className={app.language === "en" ? "active" : ""} onClick={() => app.setLanguage("en")}>English</button>
                  </div>
                </section>

                <section className="settings-section">
                  <h3>{app.t.toastPosition}</h3>
                  <select className="font-select" value={app.toastPosition} onChange={(e) => app.setToastPosition(e.target.value)}>
                    <option value="top-left">↖ {app.t.toastTopLeft}</option>
                    <option value="top-right">↗ {app.t.toastTopRight}</option>
                    <option value="bottom-left">↙ {app.t.toastBottomLeft}</option>
                    <option value="bottom-right">↘ {app.t.toastBottomRight}</option>
                  </select>
                </section>

                <section className="settings-section">
                  <h3>Custom CSS</h3>
                  <label className="setting-field">
                    <span>{app.t.themeFile}</span>
                    <div className="setting-row">
                      <input className="font-input" value={app.themeFile} onChange={(e) => app.setThemeFile(e.target.value)} placeholder={app.t.customFont} spellCheck={false} />
                    </div>
                  </label>
                </section>

                <section className="settings-section">
                  <h3>{app.t.uiFont}</h3>
                  <select className="font-select" value={app.uiFont} onChange={(e) => app.setUiFont(e.target.value)}>
                    {UI_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <label className="setting-field" style={{ marginTop: 12 }}>
                    <span>{app.t.codeFont}</span>
                    <select className="font-select" value={app.codeFont} onChange={(e) => app.setCodeFont(e.target.value)}>
                      {CODE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </label>
                  <label className="setting-field" style={{ marginTop: 12 }}>
                    <span>{app.t.customFont} (CSS)</span>
                    <div className="setting-row">
                      <input className="font-input" value={app.uiFont} onChange={(e) => app.setUiFont(e.target.value)} placeholder={app.t.customFont} spellCheck={false} />
                    </div>
                  </label>
                </section>

                <section className="settings-section">
                  <h3>{app.t.fontSize}</h3>
                  <label className="switch-row">
                    <span>{app.t.fontSizeGlobal}</span>
                    <input type="checkbox" checked={app.fontSizeGlobal} onChange={(e) => app.setFontSizeGlobal(e.target.checked)} />
                  </label>
                  {app.fontSizeGlobal ? (
                    <div className="setting-row">
                      <span>{app.t.fontSize}</span>
                      <select className="font-select" value={app.uiFontSize}
                        onChange={(e) => { app.setUiFontSize(e.target.value); app.setContentFontSize(e.target.value); }}>
                        {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="setting-row">
                        <span>{app.t.uiFontSize}</span>
                        <select className="font-select" value={app.uiFontSize} onChange={(e) => app.setUiFontSize(e.target.value)}>
                          {FONT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
                        </select>
                      </div>
                      <div className="setting-row">
                        <span>{app.t.contentFontSize}</span>
                        <select className="font-select" value={app.contentFontSize} onChange={(e) => app.setContentFontSize(e.target.value)}>
                          {CONTENT_SIZES.map(s => <option key={s} value={s}>{s}px</option>)}
                        </select>
                      </div>
                    </>
                  )}
                </section>

                <section className="settings-section">
                  <h3>{app.t.contentWidth}</h3>
                  <div className="segmented-control">
                    <button className={app.contentWidth === "600" ? "active" : ""} onClick={() => app.setContentWidth("600")}>{app.t.widthSmall} (600)</button>
                    <button className={app.contentWidth === "900" ? "active" : ""} onClick={() => app.setContentWidth("900")}>{app.t.widthMedium} (900)</button>
                    <button className={app.contentWidth === "1100" ? "active" : ""} onClick={() => app.setContentWidth("1100")}>{app.t.widthWide} (1100)</button>
                  </div>
                </section>
              </>
            )}

            {tab === "editor" && (
              <>
                <section className="settings-section">
                  <h3>{app.t.shortcuts}</h3>
                  <label className="setting-field">
                    <span>{app.t.shortcutPalette}</span>
                    <input className="font-input" value={app.shortcutPalette} onChange={(e) => app.setShortcutPalette(e.target.value)} placeholder="Ctrl+P" />
                  </label>
                  <label className="setting-field">
                    <span>{app.t.shortcutNewNote}</span>
                    <input className="font-input" value={app.shortcutNewNote} onChange={(e) => app.setShortcutNewNote(e.target.value)} placeholder="Ctrl+N" />
                  </label>
                  <label className="setting-field">
                    <span>{app.t.shortcutSave}</span>
                    <input className="font-input" value={app.shortcutSave} onChange={(e) => app.setShortcutSave(e.target.value)} placeholder="Ctrl+S" />
                  </label>
                  <label className="setting-field">
                    <span>{app.t.shortcutCloseTab}</span>
                    <input className="font-input" value={app.shortcutCloseTab} onChange={(e) => app.setShortcutCloseTab(e.target.value)} placeholder="Ctrl+W" />
                  </label>
                </section>
                <section className="settings-section">
                  <h3>{app.t.settingsShortcuts}</h3>
                  <label className="switch-row">
                    <span>{app.t.showQuickSettings}</span>
                    <input type="checkbox" checked={app.showQuickSettings} onChange={(e) => app.setShowQuickSettings(e.target.checked)} />
                  </label>
                  <label className="switch-row">
                    <span>{app.t.enableKeyboardShortcuts}</span>
                    <input type="checkbox" checked={app.enableKeyboardShortcuts} onChange={(e) => app.setEnableKeyboardShortcuts(e.target.checked)} />
                  </label>
                </section>
              </>
            )}

            {tab === "about" && (
              <section className="settings-section">
                <h3>WoxNote</h3>
                <p className="settings-desc">v0.1.0</p>
                <p className="settings-desc">Tauri + React + Rust</p>
                <p className="settings-desc">Local-first Obsidian alternative</p>
              </section>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}