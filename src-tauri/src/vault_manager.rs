use regex::Regex;
use rusqlite::{params, Connection};
use serde::Serialize;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{
        mpsc::{self, Sender},
        Arc, LazyLock, Mutex, RwLock,
    },
    thread,
    time::Duration,
};
use tauri::Emitter;
use walkdir::WalkDir;

const MD_EXTENSIONS: &[&str] = &["md", "markdown", "novel"];

static LINK_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\[\[([^\]]+)\]\]").unwrap());
static TAG_RE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?:^|\s)#([A-Za-z0-9_\u{4e00}-\u{9fff}]+)").unwrap());

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub path: String,
    pub title: String,
    pub snippet: String,
    pub score: f64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkGraph {
    pub forward: HashMap<String, Vec<String>>,
    pub backlinks: HashMap<String, Vec<String>>,
    pub tags: HashMap<String, Vec<String>>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagEntry {
    pub name: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultChangeEvent {
    pub added: Vec<String>,
    pub removed: Vec<String>,
    pub modified: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexProgress {
    pub current: usize,
    pub total: usize,
}

struct FtsHandle {
    _conn: Connection,
    vault_path: PathBuf,
}

#[derive(Clone)]
pub struct VaultManager {
    fts: Arc<Mutex<Option<FtsHandle>>>,
    graph: Arc<RwLock<LinkGraph>>,
    stop_watch_tx: Arc<Mutex<Option<Sender<()>>>>,
}

impl Default for VaultManager {
    fn default() -> Self {
        Self::new()
    }
}

impl VaultManager {
    pub fn new() -> Self {
        Self {
            fts: Arc::new(Mutex::new(None)),
            graph: Arc::new(RwLock::new(LinkGraph::default())),
            stop_watch_tx: Arc::new(Mutex::new(None)),
        }
    }

    // ── FTS5 index ──────────────────────────────────────────

    pub fn ensure_fts_index(&self, vault_path: &Path) -> Result<(), String> {
        let vault_path = vault_path.canonicalize().map_err(|e| e.to_string())?;
        let mut guard = self.fts.lock().map_err(|e| e.to_string())?;
        if guard
            .as_ref()
            .is_some_and(|handle| handle.vault_path == vault_path)
        {
            return Ok(());
        }

        let db_path = vault_path.join(".woxnote_fts.db");
        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

        conn.execute_batch(
            "CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
                relative_path,
                title,
                content,
                tokenize='unicode61'
            );",
        )
        .map_err(|e| e.to_string())?;

        *guard = Some(FtsHandle {
            _conn: conn,
            vault_path,
        });
        Ok(())
    }

    /// Run index_vault synchronously (called from background thread)
    fn do_index(
        fts: &FtsHandle,
        vault_path: &Path,
        app_handle: &tauri::AppHandle,
    ) -> Result<LinkGraph, String> {
        let md_files = collect_md_files(vault_path).map_err(|e| e.to_string())?;
        let total = md_files.len();

        fts._conn
            .execute_batch("BEGIN IMMEDIATE")
            .map_err(|e| e.to_string())?;

        let result = (|| -> Result<LinkGraph, String> {
            let mut graph = LinkGraph::default();
            fts._conn
                .execute("DELETE FROM notes_fts", [])
                .map_err(|e| e.to_string())?;

            for (i, path) in md_files.iter().enumerate() {
                let relative = path
                    .strip_prefix(vault_path)
                    .unwrap_or(path)
                    .to_string_lossy()
                    .replace('\\', "/");

                let title = path
                    .file_stem()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();

                let content = fs::read_to_string(path).unwrap_or_default();

                fts._conn
                    .execute(
                        "INSERT INTO notes_fts (relative_path, title, content) VALUES (?1, ?2, ?3)",
                        params![relative, title, content],
                    )
                    .map_err(|e| e.to_string())?;

                // Extract links
                let mut forward_links: Vec<String> = Vec::new();
                for cap in LINK_RE.captures_iter(&content) {
                    let link = cap[1].trim().to_lowercase();
                    if !forward_links.contains(&link) {
                        forward_links.push(link.clone());
                    }
                    graph
                        .backlinks
                        .entry(link)
                        .or_default()
                        .push(relative.clone());
                }
                if !forward_links.is_empty() {
                    graph.forward.insert(relative.clone(), forward_links);
                }

                // Extract tags
                for cap in TAG_RE.captures_iter(&content) {
                    let tag = cap[1].to_string();
                    graph.tags.entry(tag).or_default().push(relative.clone());
                }

                let _ = app_handle.emit(
                    "index-progress",
                    IndexProgress {
                        current: i + 1,
                        total,
                    },
                );
            }

            Ok(graph)
        })();

        match result {
            Ok(graph) => {
                fts._conn
                    .execute_batch("COMMIT")
                    .map_err(|e| e.to_string())?;
                Ok(graph)
            }
            Err(error) => {
                let _ = fts._conn.execute_batch("ROLLBACK");
                Err(error)
            }
        }
    }

    pub fn index_vault(
        &self,
        vault_path: &Path,
        app_handle: &tauri::AppHandle,
    ) -> Result<(), String> {
        self.ensure_fts_index(vault_path)?;

        let guard = self.fts.lock().map_err(|e| e.to_string())?;
        let fts = guard.as_ref().ok_or("FTS not initialized")?;
        let vault = vault_path.to_path_buf();
        let app = app_handle.clone();

        // Use FTS connection directly (we hold the lock)
        let graph = Self::do_index(fts, &vault, &app)?;

        // Update link graph
        let mut writer = self.graph.write().map_err(|e| e.to_string())?;
        *writer = graph;

        Ok(())
    }

    pub fn index_file(&self, root: &Path, relative_path: &str) -> Result<(), String> {
        let guard = self.fts.lock().map_err(|e| e.to_string())?;
        let fts = guard.as_ref().ok_or("FTS not initialized")?;

        let path = root.join(relative_path);
        let ext = path
            .extension()
            .map(|s| s.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if !MD_EXTENSIONS.contains(&ext.as_str()) {
            return Ok(());
        }

        // Remove old index entry
        fts._conn
            .execute(
                "DELETE FROM notes_fts WHERE relative_path = ?1",
                params![relative_path],
            )
            .map_err(|e| e.to_string())?;

        let title = path
            .file_stem()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_default();
        let content = if path.exists() {
            Some(fs::read_to_string(&path).unwrap_or_default())
        } else {
            None
        };

        // Update link graph
        let mut graph = self.graph.write().map_err(|e| e.to_string())?;

        graph.forward.remove(relative_path);
        for refs in graph.backlinks.values_mut() {
            refs.retain(|p| p != relative_path);
        }
        graph.backlinks.retain(|_, refs| !refs.is_empty());
        for paths in graph.tags.values_mut() {
            paths.retain(|p| p != relative_path);
        }
        graph.tags.retain(|_, paths| !paths.is_empty());

        let Some(content) = content else {
            return Ok(());
        };

        fts._conn
            .execute(
                "INSERT INTO notes_fts (relative_path, title, content) VALUES (?1, ?2, ?3)",
                params![relative_path, title, content],
            )
            .map_err(|e| e.to_string())?;

        // Extract new links
        let mut forward_links: Vec<String> = Vec::new();
        for cap in LINK_RE.captures_iter(&content) {
            let link = cap[1].trim().to_lowercase();
            if !forward_links.contains(&link) {
                forward_links.push(link.clone());
            }
            graph
                .backlinks
                .entry(link)
                .or_default()
                .push(relative_path.to_string());
        }
        if !forward_links.is_empty() {
            graph
                .forward
                .insert(relative_path.to_string(), forward_links);
        }

        // Update tags
        for cap in TAG_RE.captures_iter(&content) {
            let tag = cap[1].to_string();
            graph
                .tags
                .entry(tag)
                .or_default()
                .push(relative_path.to_string());
        }

        Ok(())
    }

    // ── FTS search ──────────────────────────────────────────

    pub fn search_vault(&self, query: &str) -> Result<Vec<SearchResult>, String> {
        let guard = self.fts.lock().map_err(|e| e.to_string())?;
        let fts = guard.as_ref().ok_or("FTS not initialized")?;

        let escaped = query.replace('"', "\"\"");
        let fts_query = format!("\"{}\"*", escaped);

        let mut stmt = fts._conn
            .prepare(
                "SELECT relative_path, title, snippet(notes_fts, 2, '<mark>', '</mark>', '...', 32), bm25(notes_fts)
                 FROM notes_fts
                 WHERE notes_fts MATCH ?1
                 ORDER BY bm25(notes_fts)
                 LIMIT 20",
            )
            .map_err(|e| e.to_string())?;

        let results: Vec<SearchResult> = stmt
            .query_map(params![fts_query], |row| {
                Ok(SearchResult {
                    path: row.get(0)?,
                    title: row.get(1)?,
                    snippet: row.get(2)?,
                    score: row.get::<_, f64>(3)?,
                })
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        Ok(results)
    }

    // ── Link graph queries ───────────────────────────────────

    pub fn get_backlinks(&self, path: &str) -> Result<Vec<String>, String> {
        let graph = self.graph.read().map_err(|e| e.to_string())?;
        let title = title_from_path(path).to_lowercase();
        Ok(graph.backlinks.get(&title).cloned().unwrap_or_default())
    }

    pub fn get_forward_links(&self, path: &str) -> Result<Vec<String>, String> {
        let graph = self.graph.read().map_err(|e| e.to_string())?;
        Ok(graph.forward.get(path).cloned().unwrap_or_default())
    }

    pub fn get_all_tags(&self) -> Result<Vec<TagEntry>, String> {
        let graph = self.graph.read().map_err(|e| e.to_string())?;
        let mut tags: Vec<TagEntry> = graph
            .tags
            .iter()
            .map(|(name, paths)| TagEntry {
                name: name.clone(),
                count: paths.len(),
            })
            .collect();
        tags.sort_by_key(|b| std::cmp::Reverse(b.count));
        Ok(tags)
    }

    // ── File watching ───────────────────────────────────────

    pub fn start_watching(
        &self,
        root: PathBuf,
        app_handle: tauri::AppHandle,
    ) -> Result<(), String> {
        use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

        self.stop_watching();

        let (tx, rx) = mpsc::channel::<Result<Event, notify::Error>>();
        let (stop_tx, stop_rx) = mpsc::channel::<()>();

        *self.stop_watch_tx.lock().map_err(|e| e.to_string())? = Some(stop_tx);

        let mut watcher = RecommendedWatcher::new(
            move |event| {
                let _ = tx.send(event);
            },
            Config::default().with_poll_interval(Duration::from_secs(2)),
        )
        .map_err(|e| e.to_string())?;

        watcher
            .watch(&root, RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;

        let vault_path = root.clone();

        thread::spawn(move || {
            let _watcher = watcher;
            loop {
                if stop_rx.try_recv().is_ok() {
                    break;
                }
                match rx.recv_timeout(Duration::from_millis(500)) {
                    Ok(Ok(event)) => {
                        let mut added = Vec::new();
                        let mut modified = Vec::new();
                        let mut removed = Vec::new();
                        for path in &event.paths {
                            let relative = path
                                .strip_prefix(&vault_path)
                                .unwrap_or(path)
                                .to_string_lossy()
                                .replace('\\', "/");
                            if path_has_hidden_component(&relative) {
                                continue;
                            }
                            match event.kind {
                                EventKind::Create(_) => added.push(relative),
                                EventKind::Modify(_) => modified.push(relative),
                                EventKind::Remove(_) => removed.push(relative),
                                _ => {}
                            }
                        }
                        if !added.is_empty() || !modified.is_empty() || !removed.is_empty() {
                            let _ = app_handle.emit(
                                "vault-changed",
                                VaultChangeEvent {
                                    added,
                                    removed,
                                    modified,
                                },
                            );
                        }
                    }
                    Ok(Err(_)) => {}
                    Err(mpsc::RecvTimeoutError::Timeout) => {}
                    Err(mpsc::RecvTimeoutError::Disconnected) => break,
                }
            }
        });

        Ok(())
    }

    pub fn stop_watching(&self) {
        let mut guard = self.stop_watch_tx.lock().unwrap();
        if let Some(tx) = guard.take() {
            let _ = tx.send(());
        }
    }
}

// ── Helpers ─────────────────────────────────────────────────

fn title_from_path(path: &str) -> &str {
    let file = path.rsplit('/').next().unwrap_or(path);
    file.strip_suffix(".md")
        .or_else(|| file.strip_suffix(".markdown"))
        .unwrap_or(file)
}

fn collect_md_files(root: &Path) -> std::io::Result<Vec<PathBuf>> {
    let root = root.canonicalize()?;
    let mut files = Vec::new();
    for entry in WalkDir::new(&root)
        .max_depth(8)
        .into_iter()
        .filter_entry(|entry| {
            entry.depth() == 0 || !entry.file_name().to_string_lossy().starts_with('.')
        })
        .filter_map(|e| e.ok())
    {
        if files.len() > 5000 {
            break;
        }
        if entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        if entry.file_type().is_dir() {
            continue;
        }
        let ext = entry
            .path()
            .extension()
            .map(|s| s.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        if MD_EXTENSIONS.contains(&ext.as_str()) {
            files.push(entry.path().to_path_buf());
        }
    }
    Ok(files)
}

fn path_has_hidden_component(relative: &str) -> bool {
    relative
        .split('/')
        .any(|part| part.starts_with('.') && !part.is_empty())
}
