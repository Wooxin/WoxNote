use crate::{backup_file, canonical_existing_dir, safe_join_path};
use serde::Serialize;
use std::{fs, path::PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionEntry {
    timestamp: String,
    path: String,
    size: u64,
}

#[tauri::command]
pub fn list_versions(root: String, relative_path: String) -> Result<Vec<VersionEntry>, String> {
    let root_path = canonical_existing_dir(&root)?;
    let backups_dir = root_path.join(".woxnote").join("versions");
    if !backups_dir.exists() {
        return Ok(Vec::new());
    }

    let safe_name = relative_path.replace(['/', '\\'], "_");
    let prefix = format!("{}_", safe_name);
    let legacy_suffix = format!("_{}", safe_name);

    let mut entries: Vec<VersionEntry> = fs::read_dir(&backups_dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            let fname = e.file_name().to_string_lossy().to_string();
            let ts = fname
                .strip_prefix(&prefix)
                .and_then(|rest| rest.split('_').next())
                .or_else(|| fname.strip_suffix(&legacy_suffix));
            Some(VersionEntry {
                timestamp: ts?.into(),
                path: e.path().to_string_lossy().to_string(),
                size: meta.len(),
            })
        })
        .collect();

    entries.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(entries)
}

#[tauri::command]
pub fn restore_version(
    root: String,
    relative_path: String,
    backup_path: String,
) -> Result<(), String> {
    let root_path = canonical_existing_dir(&root)?;
    let target = safe_join_path(&root_path, &relative_path)?;
    let backups_dir = root_path.join(".woxnote").join("versions");
    let backups_dir = backups_dir.canonicalize().map_err(|e| e.to_string())?;
    let backup = PathBuf::from(&backup_path)
        .canonicalize()
        .map_err(|e| e.to_string())?;
    if !backup.starts_with(&backups_dir) {
        return Err("Backup path escapes the vault versions directory".into());
    }
    backup_file(&root_path, &relative_path).ok_or("backup failed")?;
    fs::copy(&backup, &target).map_err(|e| e.to_string())?;
    Ok(())
}
