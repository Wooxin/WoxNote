use crate::{
    canonical_existing_dir, safe_existing_path, sanitize_title, vault_manager::VaultManager,
};
use regex::{Captures, Regex};
use serde::Serialize;
use std::fs;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FuzzyMatch {
    pub title: String,
    pub path: String,
    pub score: i32,
}

/// Simple but effective fuzzy match scoring.
/// Higher score = better match. Returns 0 for no match.
fn fuzzy_score(query: &str, target: &str) -> i32 {
    let q = query.to_lowercase();
    let t = target.to_lowercase();
    let q_chars: Vec<char> = q.chars().collect();
    let t_chars: Vec<char> = t.chars().collect();

    if q_chars.is_empty() {
        return 0;
    }
    if t_chars.is_empty() {
        return 0;
    }

    // Exact match gets highest score
    if t == q {
        return 10000;
    }

    // Prefix match bonus
    let prefix_bonus = if t.starts_with(&q) { 2000 } else { 0 };

    // Substring match
    let substr_bonus = if t.contains(&q) { 1000 } else { 0 };

    // Sequential character matching (fuzzy)
    let mut qi = 0usize;
    let mut ti = 0usize;
    let mut matches = 0i32;
    let mut gaps = 0i32;
    let mut first_match_pos: Option<usize> = None;

    while qi < q_chars.len() && ti < t_chars.len() {
        if q_chars[qi] == t_chars[ti] {
            if first_match_pos.is_none() {
                first_match_pos = Some(ti);
            }
            matches += 1;
            qi += 1;
        } else if matches > 0 {
            gaps += 1;
        }
        ti += 1;
    }

    // All chars matched
    if qi == q_chars.len() {
        let contiguity_bonus = (100 - gaps.min(99)) * 5;
        let position_bonus = match first_match_pos {
            Some(0) => 500,
            Some(p) if p <= 3 => 300,
            _ => 0,
        };
        prefix_bonus + substr_bonus + contiguity_bonus + position_bonus + matches * 10
    } else {
        // Didn't match all chars - only return score if substring matched
        if substr_bonus > 0 {
            substr_bonus + prefix_bonus
        } else {
            0
        }
    }
}

/// Fuzzy-match note titles for [[ auto-complete
#[tauri::command]
pub fn fuzzy_match_titles(query: String, vault_path: String) -> Result<Vec<FuzzyMatch>, String> {
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let vault = canonical_existing_dir(&vault_path)?;

    let mut entries: Vec<(String, String)> = Vec::new();
    for entry in walkdir::WalkDir::new(&vault)
        .max_depth(8)
        .into_iter()
        .filter_entry(|entry| {
            entry.depth() == 0 || !entry.file_name().to_string_lossy().starts_with('.')
        })
        .filter_map(|e| e.ok())
        .take(3000)
    {
        if entry.file_type().is_dir() {
            continue;
        }
        let name = entry.file_name().to_string_lossy();
        if name.starts_with('.') {
            continue;
        }
        let ext = entry
            .path()
            .extension()
            .map(|s| s.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if ext != "md" && ext != "markdown" && ext != "novel" {
            continue;
        }
        let rel = entry
            .path()
            .strip_prefix(&vault)
            .unwrap_or(entry.path())
            .to_string_lossy()
            .replace('\\', "/");
        let title = entry
            .path()
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        entries.push((title, rel));
    }

    let mut results: Vec<FuzzyMatch> = entries
        .iter()
        .filter_map(|(title, path)| {
            let score = fuzzy_score(&query, title);
            if score > 0 {
                Some(FuzzyMatch {
                    title: title.clone(),
                    path: path.clone(),
                    score,
                })
            } else {
                None
            }
        })
        .collect();

    results.sort_by(|a, b| b.score.cmp(&a.score));
    results.truncate(20);

    Ok(results)
}

/// Rename a note and update all [[links]] pointing to it across the vault
#[tauri::command]
pub fn rename_note_with_links(
    vault_path: String,
    old_relative: String,
    new_name: String,
    manager: State<'_, VaultManager>,
) -> Result<String, String> {
    let vault = canonical_existing_dir(&vault_path)?;
    let old_path = safe_existing_path(&vault_path, &old_relative)?;

    let old_title = old_path
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    let ext = old_path
        .extension()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let mut requested = new_name.trim().to_string();
    if !ext.is_empty() {
        let suffix = format!(".{}", ext);
        if requested.to_lowercase().ends_with(&suffix) {
            requested.truncate(requested.len() - suffix.len());
        }
    }

    let sanitized = sanitize_title(&requested);
    if sanitized.is_empty() {
        return Err("Invalid file name".into());
    }

    let new_file_name = if ext.is_empty() {
        sanitized.clone()
    } else {
        format!("{}.{}", sanitized, ext)
    };
    let parent = old_path.parent().unwrap_or(&vault);
    let new_path = parent.join(&new_file_name);
    let new_relative = new_path
        .strip_prefix(&vault)
        .unwrap_or(&new_path)
        .to_string_lossy()
        .replace('\\', "/");

    if new_path.exists() {
        return Err(format!("Target already exists: {}", new_relative));
    }

    fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?;

    let root_str = vault.to_string_lossy().to_string();
    let link_re = Regex::new(r"\[\[([^\]]+)\]\]").map_err(|e| e.to_string())?;
    for entry in walkdir::WalkDir::new(&vault)
        .max_depth(8)
        .into_iter()
        .filter_entry(|entry| {
            entry.depth() == 0 || !entry.file_name().to_string_lossy().starts_with('.')
        })
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_dir() {
            continue;
        }
        if entry
            .path()
            .components()
            .any(|c| c.as_os_str().to_string_lossy().starts_with('.'))
        {
            continue;
        }
        let entry_ext = entry
            .path()
            .extension()
            .map(|s| s.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if entry_ext != "md" && entry_ext != "markdown" && entry_ext != "novel" {
            continue;
        }

        if let Ok(content) = fs::read_to_string(entry.path()) {
            let updated = replace_wiki_title(&link_re, &content, &old_title, &sanitized);
            if updated != content {
                fs::write(entry.path(), updated).map_err(|e| e.to_string())?;
            }
            if let Ok(rel) = entry.path().strip_prefix(&vault) {
                let relative = rel.to_string_lossy().replace('\\', "/");
                let _ = manager.index_file(std::path::Path::new(&root_str), &relative);
            }
        }
    }

    let _ = manager.index_file(std::path::Path::new(&root_str), &old_relative);
    let _ = manager.index_file(std::path::Path::new(&root_str), &new_relative);

    Ok(new_relative)
}

fn replace_wiki_title(link_re: &Regex, content: &str, old_title: &str, new_title: &str) -> String {
    link_re
        .replace_all(content, |caps: &Captures| {
            let body = &caps[1];
            let (target, alias) = body
                .split_once('|')
                .map_or((body, ""), |(left, right)| (left, right));
            let (title, heading) = target
                .split_once('#')
                .map_or((target, ""), |(left, right)| (left, right));

            if title.trim().eq_ignore_ascii_case(old_title) {
                let heading_part = if heading.is_empty() {
                    String::new()
                } else {
                    format!("#{}", heading)
                };
                let alias_part = if alias.is_empty() {
                    String::new()
                } else {
                    format!("|{}", alias)
                };
                format!("[[{}{}{}]]", new_title, heading_part, alias_part)
            } else {
                caps[0].to_string()
            }
        })
        .into_owned()
}
