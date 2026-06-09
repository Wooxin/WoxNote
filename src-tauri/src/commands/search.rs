use crate::vault_manager::{SearchResult, TagEntry, VaultManager};
use serde::Serialize;
use std::path::PathBuf;
use tauri::{Emitter, State};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexCompleteEvent {
    pub path: String,
    pub ok: bool,
    pub message: String,
}

#[tauri::command]
pub fn search_vault(
    query: String,
    manager: State<'_, VaultManager>,
) -> Result<Vec<SearchResult>, String> {
    manager.search_vault(&query)
}

#[tauri::command]
pub fn get_backlinks_for(
    path: String,
    manager: State<'_, VaultManager>,
) -> Result<Vec<String>, String> {
    manager.get_backlinks(&path)
}

#[tauri::command]
pub fn get_forward_links_for(
    path: String,
    manager: State<'_, VaultManager>,
) -> Result<Vec<String>, String> {
    manager.get_forward_links(&path)
}

#[tauri::command]
pub fn get_all_tags(manager: State<'_, VaultManager>) -> Result<Vec<TagEntry>, String> {
    manager.get_all_tags()
}

#[tauri::command]
pub fn reindex_vault(
    path: String,
    app_handle: tauri::AppHandle,
    manager: State<'_, VaultManager>,
) -> Result<(), String> {
    let vault_path = PathBuf::from(&path);
    let mgr = manager.inner().clone();
    let event_path = path.clone();
    std::thread::spawn(move || {
        let result = mgr.index_vault(&vault_path, &app_handle);
        let event = match result {
            Ok(()) => IndexCompleteEvent {
                path: event_path,
                ok: true,
                message: String::new(),
            },
            Err(error) => IndexCompleteEvent {
                path: event_path,
                ok: false,
                message: error,
            },
        };
        let _ = app_handle.emit("index-complete", event);
    });
    Ok(())
}

#[tauri::command]
pub fn start_watching_vault(
    path: String,
    app_handle: tauri::AppHandle,
    manager: State<'_, VaultManager>,
) -> Result<(), String> {
    manager.start_watching(PathBuf::from(path), app_handle)
}

#[tauri::command]
pub fn stop_watching_vault(manager: State<'_, VaultManager>) -> Result<(), String> {
    manager.stop_watching();
    Ok(())
}

#[tauri::command]
pub fn index_file(
    root: String,
    relative_path: String,
    manager: State<'_, VaultManager>,
) -> Result<(), String> {
    manager.index_file(std::path::Path::new(&root), &relative_path)
}
