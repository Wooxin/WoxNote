# WoxNote

A lightweight, local-first note app built with Tauri and React. The vault is a normal folder, so placing it under OneDrive gives native file sync without a custom sync plugin.

## Development

On Windows, run Tauri from **x64 Native Tools Command Prompt for VS** so Rust can find MSVC `link.exe`:

```powershell
npm install
npm run tauri dev
```

For browser-only UI development:

```powershell
npm run dev
```

## Current Features

- Obsidian-style vault shell with ribbon, file tree, editor tabs, and right context pane.
- Source, reading, and split Markdown modes.
- `Ctrl+P` quick open, `Ctrl+N` new note, `Ctrl+S` save.
- Basic `[[wiki link]]`, backlinks, outbound links, and tag extraction.
- Native folder/OneDrive vault model.
- Inline preview for Markdown, text, PDF, images, Excel, Word, and PowerPoint.
