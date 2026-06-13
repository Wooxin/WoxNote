import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { CalendarDays, CheckSquare, Command, FilePlus, FolderSync, Save, Search, Settings, SidebarClose, SunMoon } from "lucide-react";
import { useAppContext } from "../contexts/AppContext";
import { useVaultContext } from "../contexts/VaultContext";
import type { NoteEntry } from "../types";
import { iconForEntry } from "../utils/helpers";

type PaletteAction = {
  id: string;
  label: string;
  hint: string;
  keywords: string;
  icon: ReactNode;
  run: () => void;
};

type PaletteItem =
  | { kind: "action"; id: string; action: PaletteAction }
  | { kind: "file"; id: string; entry: NoteEntry };

function matches(query: string, haystack: string) {
  return !query || haystack.toLowerCase().includes(query);
}

export function CommandPalette() {
  const app = useAppContext();
  const vault = useVaultContext();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const query = vault.quickQuery.trim().toLowerCase();
  const actions = useMemo<PaletteAction[]>(() => [
    {
      id: "daily-note",
      label: app.t.dailyNote,
      hint: "Daily",
      keywords: "daily today journal diary 每日 日记 今天",
      icon: <CalendarDays size={17} />,
      run: () => { vault.setIsPaletteOpen(false); void vault.openDailyNote(); },
    },
    {
      id: "new-note",
      label: app.t.newNote,
      hint: "Ctrl+N",
      keywords: "new note create 新建 笔记",
      icon: <FilePlus size={17} />,
      run: () => { vault.setIsPaletteOpen(false); void vault.createNote(); },
    },
    {
      id: "save",
      label: app.t.save,
      hint: "Ctrl+S",
      keywords: "save 保存",
      icon: <Save size={17} />,
      run: () => { vault.setIsPaletteOpen(false); void vault.saveCurrent(); },
    },
    {
      id: "tasks",
      label: app.t.tasks,
      hint: app.t.openTasks,
      keywords: "task todo tasks 待办 任务",
      icon: <CheckSquare size={17} />,
      run: () => { vault.setIsTasksOpen(true); vault.setIsPaletteOpen(false); void vault.refreshTasks(); },
    },
    {
      id: "refresh",
      label: app.t.refreshVault,
      hint: app.t.vault,
      keywords: "refresh reload sync 刷新 同步",
      icon: <FolderSync size={17} />,
      run: () => { vault.setIsPaletteOpen(false); if (app.activeVault) void vault.refreshEntries(app.activeVault); },
    },
    {
      id: "settings",
      label: app.t.settings,
      hint: app.t.settingsAppearance,
      keywords: "settings preferences option 设置 偏好",
      icon: <Settings size={17} />,
      run: () => { vault.setIsPaletteOpen(false); vault.setIsSettingsOpen(true); },
    },
    {
      id: "theme",
      label: app.t.theme,
      hint: app.theme === "dark" ? app.t.lightTheme : app.t.darkTheme,
      keywords: "theme dark light 主题 深色 浅色",
      icon: <SunMoon size={17} />,
      run: () => { vault.setIsPaletteOpen(false); app.setTheme((current) => current === "dark" ? "light" : "dark"); },
    },
    {
      id: "sidebar",
      label: app.sidebarCollapsed ? app.t.expandSidebar : app.t.collapseSidebar,
      hint: app.t.fileTree,
      keywords: "sidebar file tree collapse expand 侧边栏 文件树 折叠 展开",
      icon: <SidebarClose size={17} />,
      run: () => { vault.setIsPaletteOpen(false); app.setSidebarCollapsed((current) => !current); },
    },
  ], [app, vault]);

  const filteredActions = useMemo(() => (
    actions.filter((action) => matches(query, `${action.label} ${action.hint} ${action.keywords}`)).slice(0, 8)
  ), [actions, query]);

  const fileResults = useMemo(() => (
    vault.quickResults.filter((entry) => matches(query, entry.path)).slice(0, 12)
  ), [query, vault.quickResults]);

  const items = useMemo<PaletteItem[]>(() => [
    ...filteredActions.map((action) => ({ kind: "action" as const, id: `action:${action.id}`, action })),
    ...fileResults.map((entry) => ({ kind: "file" as const, id: `file:${entry.path}`, entry })),
  ], [fileResults, filteredActions]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    setSelectedIndex((current) => Math.min(current, Math.max(0, items.length - 1)));
  }, [items.length]);

  const runItem = (item: PaletteItem | undefined) => {
    if (!item) return;
    if (item.kind === "action") {
      item.action.run();
      return;
    }
    void vault.handleSelectFile(item.entry);
    vault.setIsPaletteOpen(false);
  };

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
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setSelectedIndex((current) => Math.min(current + 1, Math.max(0, items.length - 1)));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setSelectedIndex((current) => Math.max(current - 1, 0));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                runItem(items[selectedIndex]);
              }
            }}
            placeholder={app.t.commandPlaceholder}
          />
        </div>
        <div className="palette-results">
          {filteredActions.length > 0 && <div className="palette-section-label">{app.t.commandActions}</div>}
          {filteredActions.map((action, index) => (
            <button key={action.id} className={index === selectedIndex ? "selected" : ""} onMouseEnter={() => setSelectedIndex(index)} onClick={() => runItem({ kind: "action", id: `action:${action.id}`, action })}>
              {action.icon}
              <span>{action.label}</span>
              <kbd>{action.hint}</kbd>
            </button>
          ))}
          {fileResults.length > 0 && <div className="palette-section-label">{app.t.commandFiles}</div>}
          {fileResults.map((entry, index) => {
            const itemIndex = filteredActions.length + index;
            return (
              <button key={entry.path} className={itemIndex === selectedIndex ? "selected" : ""} onMouseEnter={() => setSelectedIndex(itemIndex)} onClick={() => runItem({ kind: "file", id: `file:${entry.path}`, entry })}>
                {iconForEntry(entry)}
                <span>{entry.path}</span>
                <kbd>{entry.extension || app.t.fileTree}</kbd>
              </button>
            );
          })}
          {items.length === 0 && (
            <div className="palette-empty">
              <Search size={18} />
              <span>{app.t.noCommandResults}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
