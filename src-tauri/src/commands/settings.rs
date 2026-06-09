use crate::{
    app_data_dir, get_setting,
    models::{StartupInfo, UserSettings, VaultSuggestion},
    open_db, set_setting,
};

// ── Macros to reduce get/set boilerplate ───────────────────

macro_rules! load_str {
    ($settings:expr, $conn:expr, $key:literal, $field:ident) => {
        if let Some(value) = get_setting($conn, $key)? {
            $settings.$field = value;
        }
    };
}
macro_rules! load_bool {
    ($settings:expr, $conn:expr, $key:literal, $field:ident) => {
        if let Some(value) = get_setting($conn, $key)? {
            $settings.$field = value == "true";
        }
    };
    ($settings:expr, $conn:expr, $key:literal, $field:ident, invert: $default:literal) => {
        if let Some(value) = get_setting($conn, $key)? {
            $settings.$field = value != $default;
        }
    };
}
macro_rules! save_str {
    ($conn:expr, $key:literal, $val:expr) => {
        set_setting($conn, $key, $val)?;
    };
}
macro_rules! save_bool {
    ($conn:expr, $key:literal, $val:expr) => {
        set_setting($conn, $key, if $val { "true" } else { "false" })?;
    };
}

// ── Commands ───────────────────────────────────────────────

#[tauri::command]
pub fn startup_info(app_handle: tauri::AppHandle) -> Result<StartupInfo, String> {
    let app_data = app_data_dir(&app_handle)?;
    let app_vault = app_data.join("Vaults").join("Default");
    Ok(StartupInfo {
        suggestions: vec![VaultSuggestion {
            name: "App Workspace".into(),
            path: app_vault.to_string_lossy().to_string(),
            kind: "local".into(),
        }],
        default_path: app_vault.to_string_lossy().to_string(),
        app_data_path: app_data.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn get_user_settings(app_handle: tauri::AppHandle) -> Result<UserSettings, String> {
    let default_vault = app_data_dir(&app_handle)?.join("Vaults").join("Default");
    let mut settings = UserSettings {
        vault_path: default_vault.to_string_lossy().to_string(),
        theme: "dark".into(),
        language: "zh".into(),
        show_quick_settings: false,
        enable_keyboard_shortcuts: true,
        sidebar_collapsed: false,
        window_maximized: false,
        ui_font: "HarmonyOS Sans".into(),
        code_font: "Cascadia Code".into(),
        collapsed_dirs_json: "[]".into(),
        vault_initialized: false,
        content_width: "900".into(),
        font_size_global: true,
        ui_font_size: "14".into(),
        content_font_size: "15".into(),
        shortcut_palette: "Ctrl+P".into(),
        shortcut_new_note: "Ctrl+N".into(),
        shortcut_save: "Ctrl+S".into(),
        shortcut_close_tab: "Ctrl+W".into(),
        theme_file: String::new(),
        toast_position: "bottom-left".into(),
        last_opened_path: String::new(),
    };

    let conn = open_db(&app_handle)?;
    load_str!(settings, &conn, "vaultPath", vault_path);
    load_str!(settings, &conn, "theme", theme);
    load_str!(settings, &conn, "language", language);
    load_bool!(settings, &conn, "showQuickSettings", show_quick_settings);
    load_bool!(settings, &conn, "enableKeyboardShortcuts", enable_keyboard_shortcuts, invert: "false");
    load_bool!(settings, &conn, "sidebarCollapsed", sidebar_collapsed);
    load_bool!(settings, &conn, "windowMaximized", window_maximized);
    load_str!(settings, &conn, "uiFont", ui_font);
    load_str!(settings, &conn, "codeFont", code_font);
    load_str!(settings, &conn, "collapsedDirsJson", collapsed_dirs_json);
    load_bool!(settings, &conn, "vaultInitialized", vault_initialized);
    load_str!(settings, &conn, "contentWidth", content_width);
    load_bool!(settings, &conn, "fontSizeGlobal", font_size_global, invert: "false");
    load_str!(settings, &conn, "uiFontSize", ui_font_size);
    load_str!(settings, &conn, "contentFontSize", content_font_size);
    load_str!(settings, &conn, "shortcutPalette", shortcut_palette);
    load_str!(settings, &conn, "shortcutNewNote", shortcut_new_note);
    load_str!(settings, &conn, "shortcutSave", shortcut_save);
    load_str!(settings, &conn, "shortcutCloseTab", shortcut_close_tab);
    load_str!(settings, &conn, "themeFile", theme_file);
    load_str!(settings, &conn, "toastPosition", toast_position);
    load_str!(settings, &conn, "lastOpenedPath", last_opened_path);
    Ok(settings)
}

#[tauri::command]
pub fn save_user_settings(
    app_handle: tauri::AppHandle,
    settings: UserSettings,
) -> Result<(), String> {
    let conn = open_db(&app_handle)?;
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), String> {
        save_str!(&conn, "vaultPath", &settings.vault_path);
        save_str!(&conn, "theme", &settings.theme);
        save_str!(&conn, "language", &settings.language);
        save_bool!(&conn, "showQuickSettings", settings.show_quick_settings);
        save_bool!(
            &conn,
            "enableKeyboardShortcuts",
            settings.enable_keyboard_shortcuts
        );
        save_bool!(&conn, "sidebarCollapsed", settings.sidebar_collapsed);
        save_bool!(&conn, "windowMaximized", settings.window_maximized);
        save_str!(&conn, "uiFont", &settings.ui_font);
        save_str!(&conn, "codeFont", &settings.code_font);
        save_str!(&conn, "collapsedDirsJson", &settings.collapsed_dirs_json);
        save_bool!(&conn, "vaultInitialized", settings.vault_initialized);
        save_str!(&conn, "contentWidth", &settings.content_width);
        save_bool!(&conn, "fontSizeGlobal", settings.font_size_global);
        save_str!(&conn, "uiFontSize", &settings.ui_font_size);
        save_str!(&conn, "contentFontSize", &settings.content_font_size);
        save_str!(&conn, "shortcutPalette", &settings.shortcut_palette);
        save_str!(&conn, "shortcutNewNote", &settings.shortcut_new_note);
        save_str!(&conn, "shortcutSave", &settings.shortcut_save);
        save_str!(&conn, "shortcutCloseTab", &settings.shortcut_close_tab);
        save_str!(&conn, "themeFile", &settings.theme_file);
        save_str!(&conn, "toastPosition", &settings.toast_position);
        save_str!(&conn, "lastOpenedPath", &settings.last_opened_path);
        Ok(())
    })();

    if result.is_err() {
        let _ = conn.execute("ROLLBACK", []);
        return result;
    }
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
    Ok(())
}
