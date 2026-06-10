use crate::{
    backup_file, canonical_existing_dir, collect_entries, safe_existing_path, safe_join_path,
    sanitize_title, NoteEntry,
};
use std::{fs, path::PathBuf};

#[tauri::command]
pub fn ensure_vault(path: String) -> Result<(), String> {
    fs::create_dir_all(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn choose_vault_folder(current: Option<String>) -> Result<Option<String>, String> {
    let mut dialog = rfd::FileDialog::new().set_title("选择 WoxNote 笔记库");
    if let Some(path) = current {
        let p = PathBuf::from(path);
        if p.exists() {
            dialog = dialog.set_directory(p);
        }
    }
    Ok(dialog
        .pick_folder()
        .map(|p| p.to_string_lossy().to_string()))
}

#[tauri::command]
pub fn list_entries(root: String) -> Result<Vec<NoteEntry>, String> {
    let root_path = canonical_existing_dir(&root)?;
    collect_entries(&root_path)
}

#[tauri::command]
pub fn read_text_file(root: String, relative_path: String) -> Result<String, String> {
    let path = safe_existing_path(&root, &relative_path)?;
    fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_binary_file(root: String, relative_path: String) -> Result<Vec<u8>, String> {
    let path = safe_existing_path(&root, &relative_path)?;
    fs::read(path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_text_file(root: String, relative_path: String, content: String) -> Result<(), String> {
    let root_path = canonical_existing_dir(&root)?;
    let target = safe_join_path(&root_path, &relative_path)?;
    let parent = target.parent().ok_or("Invalid file path")?;
    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let parent = parent.canonicalize().map_err(|e| e.to_string())?;
    if !parent.starts_with(&root_path) {
        return Err("File path escapes the vault".into());
    }
    let _ = backup_file(&root_path, &relative_path);
    fs::write(target, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_note(root: String, title: String) -> Result<String, String> {
    let clean_title = sanitize_title(&title);
    let filename = format!("{clean_title}.md");
    let mut relative = PathBuf::from(filename);
    let root_path = canonical_existing_dir(&root)?;
    let mut index = 2;
    while root_path.join(&relative).exists() {
        relative = PathBuf::from(format!("{clean_title} {index}.md"));
        index += 1;
    }
    let heading = if clean_title == "Untitled" {
        "Untitled".into()
    } else {
        clean_title.replace('-', " ")
    };
    fs::write(root_path.join(&relative), format!("# {heading}\n\n")).map_err(|e| e.to_string())?;
    Ok(relative.to_string_lossy().replace('\\', "/"))
}

#[tauri::command]
pub fn create_note_in_dir(root: String, dir: String, title: String) -> Result<String, String> {
    let root_path = canonical_existing_dir(&root)?;
    let clean_title = sanitize_title(&title);
    let filename = format!("{clean_title}.md");
    let dir_path = safe_join_path(&root_path, &dir)?;
    fs::create_dir_all(&dir_path).map_err(|e| e.to_string())?;
    let mut relative = dir_path.join(&filename);
    let mut index = 2;
    while relative.exists() {
        relative = dir_path.join(format!("{clean_title} {index}.md"));
        index += 1;
    }
    let heading = if clean_title == "Untitled" {
        "Untitled".into()
    } else {
        clean_title.replace('-', " ")
    };
    fs::write(&relative, format!("# {heading}\n\n")).map_err(|e| e.to_string())?;
    let rel = relative
        .strip_prefix(&root_path)
        .unwrap_or(&relative)
        .to_string_lossy()
        .replace('\\', "/");
    Ok(rel)
}

#[tauri::command]
pub fn create_folder(root: String, dir: String, title: String) -> Result<String, String> {
    let root_path = canonical_existing_dir(&root)?;
    let clean_title = sanitize_title(&title);
    let parent = safe_join_path(&root_path, &dir)?;
    fs::create_dir_all(&parent).map_err(|e| e.to_string())?;

    let mut folder = parent.join(&clean_title);
    let mut index = 2;
    while folder.exists() {
        folder = parent.join(format!("{clean_title} {index}"));
        index += 1;
    }
    fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
    let rel = folder
        .strip_prefix(&root_path)
        .unwrap_or(&folder)
        .to_string_lossy()
        .replace('\\', "/");
    Ok(rel)
}

#[tauri::command]
pub fn rename_entry(root: String, old_path: String, new_name: String) -> Result<String, String> {
    let root_path = canonical_existing_dir(&root)?;
    let old = safe_existing_path(&root, &old_path)?;
    let parent = old.parent().ok_or("Invalid path")?;
    if !parent.starts_with(&root_path) {
        return Err("File path escapes the vault".into());
    }

    let mut clean_name = sanitize_title(&new_name);
    if old.is_file() && PathBuf::from(&clean_name).extension().is_none() {
        if let Some(ext) = old.extension().and_then(|s| s.to_str()) {
            clean_name = format!("{}.{}", clean_name, ext);
        }
    }

    let new_path = parent.join(&clean_name);
    let new_rel = new_path
        .strip_prefix(&root_path)
        .unwrap_or(&new_path)
        .to_string_lossy()
        .replace('\\', "/");
    if new_path.exists() {
        return Err("A file with that name already exists".into());
    }
    fs::rename(&old, &new_path).map_err(|e| e.to_string())?;
    Ok(new_rel)
}

#[tauri::command]
pub fn delete_entry(root: String, relative_path: String) -> Result<(), String> {
    let path = safe_existing_path(&root, &relative_path)?;
    let root_path = canonical_existing_dir(&root)?;
    if path == root_path {
        return Err("Cannot delete the vault root".into());
    }
    if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn check_is_dir(path: String) -> Result<bool, String> {
    Ok(std::path::Path::new(&path).is_dir())
}

#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
