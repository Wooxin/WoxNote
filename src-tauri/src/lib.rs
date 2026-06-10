use rusqlite::{params, Connection};
use std::{
    fs,
    path::{Component, Path, PathBuf},
    time::UNIX_EPOCH,
};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};
use walkdir::WalkDir;

mod models;
pub use models::{NoteEntry, StartupInfo, UserSettings, VaultSuggestion};
mod vault_manager;
pub use vault_manager::{SearchResult, TagEntry, VaultManager};
mod commands;

// ── Shared helpers ─────────────────────────────────────────

pub fn app_data_dir(_app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    // Portable: always store data next to the executable
    let path = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .map(|p| p.join("WoxNoteData"))
        .unwrap_or_else(|| PathBuf::from("WoxNoteData"));
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

pub fn open_db(app_handle: &tauri::AppHandle) -> Result<Connection, String> {
    let db_path = app_data_dir(app_handle)?.join("woxnote.db");
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
        [],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn)
}

pub fn get_setting(conn: &Connection, key: &str) -> Result<Option<String>, String> {
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| e.to_string())?;
    let mut rows = stmt.query(params![key]).map_err(|e| e.to_string())?;
    if let Some(row) = rows.next().map_err(|e| e.to_string())? {
        Ok(Some(row.get(0).map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

pub fn set_setting(conn: &Connection, key: &str, value: &str) -> Result<(), String> {
    conn.execute("INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value", params![key, value]).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn collect_entries(root: &Path) -> Result<Vec<NoteEntry>, String> {
    let root = root.canonicalize().map_err(|e| e.to_string())?;
    let mut entries = Vec::new();
    for entry in WalkDir::new(&root)
        .max_depth(8)
        .into_iter()
        .filter_entry(|entry| {
            entry.depth() == 0 || !entry.file_name().to_string_lossy().starts_with('.')
        })
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if path == root {
            continue;
        }
        let file_name = entry.file_name().to_string_lossy();
        if file_name.starts_with('.') {
            continue;
        }
        if entries.len() >= 3000 {
            break;
        }
        let relative = path
            .strip_prefix(&root)
            .unwrap_or(path)
            .to_string_lossy()
            .replace('\\', "/");
        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        let extension = path
            .extension()
            .map(|e| e.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let modified = metadata
            .modified()
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or_default();
        entries.push(NoteEntry {
            name: file_name.to_string(),
            path: relative,
            extension,
            is_dir: entry.file_type().is_dir(),
            size: metadata.len(),
            modified,
        });
    }
    entries.sort_by_key(|a| a.path.to_lowercase());
    Ok(entries)
}

pub fn safe_existing_path(root: &str, relative_path: &str) -> Result<PathBuf, String> {
    let root_path = canonical_existing_dir(root)?;
    let target = safe_join_path(&root_path, relative_path)?;
    if !target.exists() {
        return Err(format!("File not found: {}", relative_path));
    }
    let canonical = target.canonicalize().map_err(|e| e.to_string())?;
    if !canonical.starts_with(&root_path) {
        return Err("File path escapes the vault".into());
    }
    Ok(canonical)
}

pub fn safe_join_path(root: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let relative = Path::new(relative_path);
    if relative.components().any(|component| {
        matches!(
            component,
            Component::Prefix(_) | Component::RootDir | Component::ParentDir
        )
    }) {
        return Err("File path escapes the vault".into());
    }
    Ok(root.join(relative))
}

pub fn canonical_existing_dir(path: &str) -> Result<PathBuf, String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(format!("Directory not found: {}", path));
    }
    p.canonicalize().map_err(|e| e.to_string())
}

pub fn sanitize_title(raw: &str) -> String {
    let cleaned: String = raw
        .trim()
        .chars()
        .map(|c| match c {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '-',
            _ => c,
        })
        .collect();
    let trimmed = cleaned.trim_matches(|c: char| c == '.' || c == '-' || c.is_whitespace());
    if trimmed.is_empty() {
        "Untitled".into()
    } else {
        trimmed.to_string()
    }
}

pub fn backup_file(root: &Path, relative_path: &str) -> Option<PathBuf> {
    let backups_dir = root.join(".woxnote").join("versions");
    if fs::create_dir_all(&backups_dir).is_err() {
        return None;
    }
    let source = safe_join_path(root, relative_path).ok()?;
    if !source.exists() {
        return None;
    }
    let now = std::time::SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()?;
    let datetime = now.as_secs();
    let safe_name = relative_path.replace(['/', '\\'], "_");
    let backup_name = format!("{}_{}", safe_name, datetime);
    let backup_path = backups_dir.join(&backup_name);
    fs::copy(&source, &backup_path).ok()?;
    // Keep only last 20 backups per file
    let prefix = format!("{}_", safe_name);
    if let Ok(entries) = fs::read_dir(&backups_dir) {
        let mut matches: Vec<_> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.file_name().to_string_lossy().starts_with(&prefix))
            .collect();
        if matches.len() > 20 {
            matches.sort_by_key(|e| e.file_name());
            for old in matches.iter().take(matches.len() - 20) {
                let _ = fs::remove_file(old.path());
            }
        }
    }
    Some(backup_path)
}

#[cfg(target_os = "windows")]
fn app_icon() -> Option<Image<'static>> {
    let icon_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("icons")
        .join("icon.ico");
    if icon_path.exists() {
        let bytes = std::fs::read(icon_path).ok()?;
        Image::from_bytes(&bytes).ok()
    } else {
        None
    }
}

#[cfg(not(target_os = "windows"))]
fn app_icon() -> Option<Image<'static>> {
    None
}

// ── App entry ──────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _lock_listener = std::net::TcpListener::bind("127.0.0.1:19876");
    if _lock_listener.is_err() {
        std::process::exit(0);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            app.manage(VaultManager::new());

            let window = app.get_webview_window("main").unwrap();

            // Disable default webview right-click context menu
            let js =
                "document.addEventListener('contextmenu', function(e) { e.preventDefault(); });";
            let _ = window.eval(js);

            let app_handle = app.handle().clone();
            let conn = open_db(&app_handle)?;
            if let Some(val) = get_setting(&conn, "windowMaximized")? {
                if val == "true" {
                    let _ = window.maximize();
                }
            }

            let show =
                MenuItem::with_id(app, "show", "\u{663E}\u{793A} WoxNote", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "\u{9000}\u{51FA}", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &quit])?;
            let icon = app_icon().unwrap_or_else(|| {
                app.default_window_icon()
                    .expect("missing WoxNote icon")
                    .clone()
            });
            TrayIconBuilder::new()
                .tooltip("WoxNote")
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::CloseRequested { api, .. } => {
                api.prevent_close();
                let _ = window.hide();
            }
            WindowEvent::Resized(_) => {
                let app_handle = window.app_handle();
                if let Ok(conn) = open_db(app_handle) {
                    let is_max = window.is_maximized().unwrap_or(false);
                    let _ = set_setting(
                        &conn,
                        "windowMaximized",
                        if is_max { "true" } else { "false" },
                    );
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::startup_info,
            commands::settings::get_user_settings,
            commands::settings::save_user_settings,
            commands::files::ensure_vault,
            commands::files::choose_vault_folder,
            commands::files::list_entries,
            commands::files::read_text_file,
            commands::files::read_binary_file,
            commands::files::write_text_file,
            commands::files::create_note,
            commands::files::create_note_in_dir,
            commands::files::create_folder,
            commands::files::delete_entry,
            commands::files::rename_entry,
            commands::files::open_in_explorer,
            commands::search::search_vault,
            commands::search::get_backlinks_for,
            commands::search::get_forward_links_for,
            commands::search::get_all_tags,
            commands::search::reindex_vault,
            commands::search::start_watching_vault,
            commands::search::stop_watching_vault,
            commands::search::index_file,
            commands::preview::extract_toc_rust,
            commands::preview::count_words,
            commands::preview::preview_binary,
            commands::preview::export_note_html,
            commands::image::paste_image,
            commands::version::list_versions,
            commands::version::restore_version,
            commands::fuzzy::fuzzy_match_titles,
            commands::fuzzy::rename_note_with_links
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
