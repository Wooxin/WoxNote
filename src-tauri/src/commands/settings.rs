use crate::{
    app_data_dir, get_setting,
    models::{StartupInfo, UserSettings},
    open_db, set_setting,
};

macro_rules! load_str {
    ($s:expr, $c:expr, $k:literal, $f:ident) => {
        if let Some(v) = get_setting($c, $k)? {
            $s.$f = v;
        }
    };
}
macro_rules! load_bool {
    ($s:expr, $c:expr, $k:literal, $f:ident) => {
        if let Some(v) = get_setting($c, $k)? {
            $s.$f = v == "true";
        }
    };
    ($s:expr, $c:expr, $k:literal, $f:ident, invert: $d:literal) => {
        if let Some(v) = get_setting($c, $k)? {
            $s.$f = v != $d;
        }
    };
}
macro_rules! save_str {
    ($c:expr, $k:literal, $v:expr) => {
        set_setting($c, $k, $v)?;
    };
}
macro_rules! save_bool {
    ($c:expr, $k:literal, $v:expr) => {
        set_setting($c, $k, if $v { "true" } else { "false" })?;
    };
}

#[tauri::command]
pub fn startup_info(app_handle: tauri::AppHandle) -> Result<StartupInfo, String> {
    Ok(StartupInfo {
        suggestions: vec![],
        default_path: String::new(),
        app_data_path: app_data_dir(&app_handle)?.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn get_user_settings(app_handle: tauri::AppHandle) -> Result<UserSettings, String> {
    let mut settings = UserSettings {
        vaults_json: "[]".into(),
        active_vault: String::new(),
        theme: "dark".into(),
        language: "zh".into(),
        show_quick_settings: false,
        enable_keyboard_shortcuts: true,
        sidebar_collapsed: false,
        window_maximized: false,
        open_tabs_json: String::new(),
        selected_path: String::new(),
        bookmarks_json: "[]".into(),
        pinned_tabs_json: "[]".into(),
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
    };
    let conn = open_db(&app_handle)?;
    load_str!(settings, &conn, "vaultsJson", vaults_json);
    load_str!(settings, &conn, "activeVault", active_vault);
    load_str!(settings, &conn, "theme", theme);
    load_str!(settings, &conn, "language", language);
    load_bool!(settings, &conn, "showQuickSettings", show_quick_settings);
    load_bool!(settings, &conn, "enableKeyboardShortcuts", enable_keyboard_shortcuts, invert:"false");
    load_bool!(settings, &conn, "sidebarCollapsed", sidebar_collapsed);
    load_bool!(settings, &conn, "windowMaximized", window_maximized);
    load_str!(settings, &conn, "openTabsJson", open_tabs_json);
    load_str!(settings, &conn, "selectedPath", selected_path);
    load_str!(settings, &conn, "bookmarksJson", bookmarks_json);
    load_str!(settings, &conn, "pinnedTabsJson", pinned_tabs_json);
    load_str!(settings, &conn, "uiFont", ui_font);
    load_str!(settings, &conn, "codeFont", code_font);
    load_str!(settings, &conn, "collapsedDirsJson", collapsed_dirs_json);
    load_bool!(settings, &conn, "vaultInitialized", vault_initialized);
    load_str!(settings, &conn, "contentWidth", content_width);
    load_bool!(settings, &conn, "fontSizeGlobal", font_size_global, invert:"false");
    load_str!(settings, &conn, "uiFontSize", ui_font_size);
    load_str!(settings, &conn, "contentFontSize", content_font_size);
    load_str!(settings, &conn, "shortcutPalette", shortcut_palette);
    load_str!(settings, &conn, "shortcutNewNote", shortcut_new_note);
    load_str!(settings, &conn, "shortcutSave", shortcut_save);
    load_str!(settings, &conn, "shortcutCloseTab", shortcut_close_tab);
    load_str!(settings, &conn, "themeFile", theme_file);
    load_str!(settings, &conn, "toastPosition", toast_position);
    eprintln!(
        "[WoxNote] get_user_settings loaded: vaultsJson={} activeVault={}",
        settings.vaults_json, settings.active_vault
    );
    Ok(settings)
}

#[tauri::command]
pub fn save_user_settings(
    app_handle: tauri::AppHandle,
    settings: UserSettings,
) -> Result<(), String> {
    eprintln!(
        "[WoxNote] save_user_settings called: vaultsJson={} activeVault={}",
        settings.vaults_json, settings.active_vault
    );
    let conn = open_db(&app_handle)?;
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| e.to_string())?;
    let r = (|| -> Result<(), String> {
        save_str!(&conn, "vaultsJson", &settings.vaults_json);
        save_str!(&conn, "activeVault", &settings.active_vault);
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
        save_str!(&conn, "openTabsJson", &settings.open_tabs_json);
        save_str!(&conn, "selectedPath", &settings.selected_path);
        save_str!(&conn, "bookmarksJson", &settings.bookmarks_json);
        save_str!(&conn, "pinnedTabsJson", &settings.pinned_tabs_json);
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
        Ok(())
    })();
    if r.is_err() {
        let _ = conn.execute("ROLLBACK", []);
        return r;
    }
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
    Ok(())
}
