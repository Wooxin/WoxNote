// Mock data for WoxNote browser/development mode
import type { NoteEntry } from "../types";

export const mockStore: Record<string, string> = {
  "Welcome.md": "# WoxNote\n\nA local-first note vault.\n\n## Features\n\n**Bold** and *italic* and ~~strikethrough~~ and inline code.\n\n### Links\n- Wiki: [[Roadmap]]\n- External: [OpenAI](https://openai.com)\n\n### Lists\n- Item one\n- Item two\n- [x] Done task\n- [ ] Todo task\n\n### Table\n| A | B | C |\n| --- | --- | --- |\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |\n\n```python\nprint(\"Hello\")\n```\n\n#tag",
  "Projects/Roadmap.md": "# Roadmap\n\n- Faster startup\n- Native PDF/Office preview\n- Backlinks\n- Command palette\n\nBack to [[Welcome]].",
};

export function createMockEntries(): NoteEntry[] {
  return [
    { name: "Projects", path: "Projects", extension: "", isDir: true, size: 0, modified: 1780740000 },
    { name: "Welcome.md", path: "Welcome.md", extension: "md", isDir: false, size: 190, modified: 1780740300 },
    { name: "Roadmap.md", path: "Projects/Roadmap.md", extension: "md", isDir: false, size: 130, modified: 1780740200 },
  ];
}