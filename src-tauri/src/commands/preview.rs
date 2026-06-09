use crate::safe_existing_path;
use pulldown_cmark::{html, Options, Parser};
use regex::Regex;
use serde::Serialize;
use std::{fs, path::Path, sync::LazyLock};

static WIKI_LINK_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"\[\[([^\]]+)\]\]").unwrap());
static TAG_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"(^|\s)#([A-Za-z0-9_]+)").unwrap());
static TOC_RE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(#{1,3})\s+(.+)$").unwrap());

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FormatResult {
    pub content: String,
    pub cursor_start: usize,
    pub cursor_end: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TocEntry {
    pub level: usize,
    pub text: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BinaryPreview {
    #[serde(rename = "type")]
    pub preview_type: String,
    pub sheets: Vec<SheetData>,
    pub text: String,
    pub slides: Vec<String>,
    pub message: String,
}

#[derive(Serialize)]
pub struct SheetData {
    pub name: String,
    pub rows: Vec<Vec<String>>,
}

#[tauri::command]
pub fn render_markdown(source: String) -> Result<String, String> {
    let processed = source;
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    let parser = Parser::new_ext(&processed, options);
    let mut html_output = String::new();
    html::push_html(&mut html_output, parser);
    let html = WIKI_LINK_RE.replace_all(&html_output, |caps: &regex::Captures| {
        format!(
            "<button class=\"wiki-link\" data-wiki-link=\"{0}\">[[{0}]]</button>",
            &caps[1]
        )
    });
    let html = TAG_RE.replace_all(&html, |caps: &regex::Captures| {
        format!("{}<span class=\"tag-chip\">#{}</span>", &caps[1], &caps[2])
    });
    Ok(html.to_string())
}

#[tauri::command]
pub fn apply_md_format(
    text: String,
    start: usize,
    end: usize,
    action: String,
    color: Option<String>,
) -> Result<FormatResult, String> {
    let selected = &text[start..end];
    let (replacement, cs, ce) = match action.as_str() {
        "bold" => (format!("**{}**", selected), 2usize, 2usize),
        "italic" if start == end => ("*text*".into(), 1usize, 4usize),
        "italic" => (format!("*{}*", selected), 1usize, 1usize),
        "highlight" => (format!("=={}==", selected), 2usize, 2usize),
        "underline" => (format!("++{}++", selected), 2usize, 2usize),
        "color" => {
            let c = color.unwrap_or_default();
            if start == end {
                let r = format!("<span style=\"color:{}\">text</span>", c);
                let pos = r.find("text").unwrap_or(0);
                (r, pos, pos + 4)
            } else {
                let r = format!("<span style=\"color:{}\">{}</span>", c, selected);
                let pos = r.find(selected).unwrap_or(0);
                (r, pos, pos + selected.len())
            }
        }
        _ => return Err(format!("Unknown action: {}", action)),
    };
    let new_text = format!("{}{}{}", &text[..start], replacement, &text[end..]);
    Ok(FormatResult {
        content: new_text,
        cursor_start: start + cs,
        cursor_end: start + ce,
    })
}

#[tauri::command]
pub fn split_content_blocks(content: String) -> Vec<String> {
    let raw: Vec<&str> = content.split('\n').collect();
    let mut blocks: Vec<String> = Vec::new();
    for line in raw {
        if line.starts_with('|') && !blocks.is_empty() {
            if let Some(prev) = blocks.last() {
                let all_table = prev
                    .lines()
                    .all(|l| l.starts_with('|') || l.starts_with("|-") || l.starts_with("|:"));
                if all_table {
                    *blocks.last_mut().unwrap() = format!("{}\n{}", prev, line);
                    continue;
                }
            }
        }
        if line.starts_with("```") && !blocks.is_empty() {
            if let Some(prev) = blocks.last() {
                if prev.lines().next().unwrap_or("").starts_with("```") && !prev.ends_with("```") {
                    *blocks.last_mut().unwrap() = format!("{}\n{}", prev, line);
                    continue;
                }
            }
        }
        blocks.push(line.to_string());
    }
    blocks
}

#[tauri::command]
pub fn extract_toc_rust(content: String) -> Vec<TocEntry> {
    content
        .lines()
        .filter_map(|line| {
            TOC_RE.captures(line).map(|caps| TocEntry {
                level: caps[1].len(),
                text: caps[2].trim().to_string(),
            })
        })
        .collect()
}

#[tauri::command]
pub fn preview_binary(root: String, relative_path: String) -> Result<BinaryPreview, String> {
    let path = safe_existing_path(&root, &relative_path)?;
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    match ext.as_str() {
        "xlsx" | "xls" => preview_xlsx(&path),
        "docx" => preview_docx(&path),
        "pptx" => preview_pptx(&path),
        _ => Ok(BinaryPreview {
            preview_type: "unsupported".into(),
            sheets: vec![],
            text: String::new(),
            slides: vec![],
            message: "use JS fallback".into(),
        }),
    }
}

fn preview_xlsx(path: &Path) -> Result<BinaryPreview, String> {
    use calamine::{open_workbook_auto, Reader};
    let mut workbook = open_workbook_auto(path).map_err(|e| e.to_string())?;
    let sheets: Vec<SheetData> = workbook
        .sheet_names()
        .iter()
        .filter_map(|name| {
            workbook.worksheet_range(name).ok().map(|range| {
                let rows: Vec<Vec<String>> = range
                    .rows()
                    .take(80)
                    .map(|row| row.iter().map(|c| c.to_string()).collect())
                    .collect();
                SheetData {
                    name: name.clone(),
                    rows,
                }
            })
        })
        .collect();
    Ok(BinaryPreview {
        preview_type: "sheet".into(),
        sheets,
        text: String::new(),
        slides: vec![],
        message: String::new(),
    })
}

fn preview_docx(path: &Path) -> Result<BinaryPreview, String> {
    let text = extract_docx_text(path)?;
    Ok(BinaryPreview {
        preview_type: "document".into(),
        sheets: vec![],
        text,
        slides: vec![],
        message: String::new(),
    })
}

fn preview_pptx(path: &Path) -> Result<BinaryPreview, String> {
    use quick_xml::events::Event;
    use quick_xml::Reader as XmlReader;
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut slides: Vec<String> = Vec::new();
    let mut nums: Vec<usize> = Vec::new();
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") {
            if let Some(num) = name
                .strip_prefix("ppt/slides/slide")
                .and_then(|s| s.strip_suffix(".xml"))
                .and_then(|s| s.parse::<usize>().ok())
            {
                nums.push(num);
            }
        }
    }
    nums.sort();
    for num in nums {
        if let Ok(entry) = archive.by_name(&format!("ppt/slides/slide{}.xml", num)) {
            let buf_reader = std::io::BufReader::new(entry);
            let mut reader = XmlReader::from_reader(buf_reader);
            reader.config_mut().trim_text(true);
            let mut text = String::new();
            let mut in_text = false;
            let mut buf = Vec::new();
            loop {
                match reader.read_event_into(&mut buf) {
                    Ok(Event::Start(e)) => {
                        if e.local_name().as_ref() == b"t" {
                            in_text = true;
                        }
                    }
                    Ok(Event::Text(e)) => {
                        if in_text {
                            if let Ok(t) = e.unescape() {
                                text.push_str(&t);
                            }
                        }
                    }
                    Ok(Event::End(e)) => {
                        if e.local_name().as_ref() == b"t" {
                            in_text = false;
                        }
                    }
                    Ok(Event::Eof) => break,
                    Err(_) => break,
                    _ => {}
                }
                buf.clear();
            }
            slides.push(text.trim().to_string());
        }
    }
    Ok(BinaryPreview {
        preview_type: "slides".into(),
        sheets: vec![],
        text: String::new(),
        slides,
        message: String::new(),
    })
}

#[tauri::command]
pub fn extract_file_text(root: String, relative_path: String) -> Result<String, String> {
    let path = safe_existing_path(&root, &relative_path)?;
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();
    let text = match ext.as_str() {
        "pdf" => extract_pdf_text(&path)?,
        "xlsx" | "xls" => extract_xlsx_text(&path)?,
        "docx" => extract_docx_text(&path)?,
        "pptx" => extract_pptx_text(&path)?,
        _ => return Err("Unsupported file type".into()),
    };
    Ok(text)
}

fn extract_pdf_text(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| e.to_string())?;
    let doc = lopdf::Document::load_mem(&bytes).map_err(|e| e.to_string())?;
    let mut texts = Vec::new();
    for (page_num, _) in doc.page_iter() {
        texts.push(doc.extract_text(&[page_num]).unwrap_or_default());
    }
    Ok(texts.join("\n\n"))
}

fn extract_xlsx_text(path: &Path) -> Result<String, String> {
    use calamine::{open_workbook_auto, Reader};
    let mut workbook = open_workbook_auto(path).map_err(|e| e.to_string())?;
    let mut output = String::new();
    for name in workbook.sheet_names().iter() {
        if let Ok(range) = workbook.worksheet_range(name) {
            output.push_str(&format!("# {}\n\n", name));
            for row in range.rows().take(100) {
                let cells: Vec<String> = row.iter().map(|c| c.to_string()).collect();
                output.push_str(&cells.join("\t"));
                output.push('\n');
            }
            output.push_str("\n\n");
        }
    }
    Ok(output.trim().to_string())
}

fn extract_docx_text(path: &Path) -> Result<String, String> {
    use quick_xml::events::Event;
    use quick_xml::Reader as XmlReader;
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let doc = archive
        .by_name("word/document.xml")
        .map_err(|e| format!("Not a valid DOCX: {}", e))?;
    let buf_reader = std::io::BufReader::new(doc);
    let mut reader = XmlReader::from_reader(buf_reader);
    reader.config_mut().trim_text(true);
    let mut text = String::new();
    let mut in_paragraph = false;
    let mut buf = Vec::new();
    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(e)) => {
                if e.local_name().as_ref() == b"p" {
                    if !text.is_empty() && !text.ends_with("\n\n") {
                        text.push_str("\n\n");
                    }
                    in_paragraph = true;
                }
            }
            Ok(Event::Text(e)) => {
                if in_paragraph {
                    if let Ok(t) = e.unescape() {
                        text.push_str(&t);
                    }
                }
            }
            Ok(Event::End(e)) => {
                if e.local_name().as_ref() == b"p" {
                    in_paragraph = false;
                }
            }
            Ok(Event::Eof) => break,
            Err(_) => break,
            _ => {}
        }
        buf.clear();
    }
    Ok(text.trim().to_string())
}

fn extract_pptx_text(path: &Path) -> Result<String, String> {
    let file = fs::File::open(path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let mut output = String::new();
    let mut nums: Vec<usize> = Vec::new();
    for i in 0..archive.len() {
        let entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") {
            if let Some(num) = name
                .strip_prefix("ppt/slides/slide")
                .and_then(|s| s.strip_suffix(".xml"))
                .and_then(|s| s.parse::<usize>().ok())
            {
                nums.push(num);
            }
        }
    }
    nums.sort();
    for num in nums {
        if let Ok(entry) = archive.by_name(&format!("ppt/slides/slide{}.xml", num)) {
            let content = std::io::read_to_string(entry).map_err(|e| e.to_string())?;
            let mut text = String::new();
            let mut in_text = false;
            let mut tag = String::new();
            for ch in content.chars() {
                if ch == '<' {
                    tag.clear();
                    in_text = false;
                }
                if in_text {
                    text.push(ch);
                }
                tag.push(ch);
                if ch == '>' && (tag.starts_with("<a:t ") || tag == "<a:t>") {
                    in_text = true;
                }
            }
            output.push_str(&format!("## Slide {}\n\n{}\n\n", num, text.trim()));
        }
    }
    Ok(output.trim().to_string())
}

#[tauri::command]
pub fn export_note_html(content: String, title: String) -> Result<String, String> {
    let mut options = Options::empty();
    options.insert(Options::ENABLE_TABLES);
    options.insert(Options::ENABLE_STRIKETHROUGH);
    let parser = Parser::new_ext(&content, options);
    let mut body = String::new();
    html::push_html(&mut body, parser);
    let body = WIKI_LINK_RE.replace_all(&body, |caps: &regex::Captures| {
        format!("<span class=\"wiki-link\">[[{}]]</span>", &caps[1])
    });
    Ok(format!(
        r#"<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><title>{title}</title><style>body{{max-width:900px;margin:40px auto;padding:0 20px;font:15px/1.75 var(--ui-font,Inter,sans-serif);color:#1e2732;background:#fff}}h1{{font-size:28px}}h2{{font-size:22px}}h3{{font-size:18px}}pre{{background:#f4f7f9;padding:14px;border-radius:8px}}code{{background:#eef2f5;padding:2px 5px;border-radius:4px;font-size:13px}}pre code{{background:transparent;padding:0}}table{{border-collapse:collapse;width:100%}}th,td{{border:1px solid #ddd;padding:8px 12px}}th{{background:#f4f7f9}}blockquote{{border-left:3px solid #d0d7de;margin:0;padding:0 14px;color:#57606a}}img{{max-width:100%}}.wiki-link{{color:#0969da;background:#ddf4ff;padding:0 4px;border-radius:3px}}</style></head><body>{body}</body></html>"#
    ))
}
