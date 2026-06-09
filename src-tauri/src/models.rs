use serde::{Deserialize, Serialize};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultSuggestion {
    pub name: String,
    pub path: String,
    pub kind: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupInfo {
    pub suggestions: Vec<VaultSuggestion>,
    pub default_path: String,
    pub app_data_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteEntry {
    pub name: String,
    pub path: String,
    pub extension: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UserSettings {
    pub vault_path: String,
    pub theme: String,
    pub language: String,
    pub show_quick_settings: bool,
    pub enable_keyboard_shortcuts: bool,
    pub sidebar_collapsed: bool,
    pub window_maximized: bool,
    pub ui_font: String,
    pub code_font: String,
    pub collapsed_dirs_json: String,
    pub vault_initialized: bool,
    pub content_width: String,
    pub font_size_global: bool,
    pub ui_font_size: String,
    pub content_font_size: String,
    pub shortcut_palette: String,
    pub shortcut_new_note: String,
    pub shortcut_save: String,
    pub shortcut_close_tab: String,
    pub theme_file: String,
    pub toast_position: String,
    pub last_opened_path: String,
}
