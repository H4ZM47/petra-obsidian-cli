// packages/plugin/src/routes/search.ts

import { App } from "obsidian";
import { PetraServer } from "../server";
import type { SearchResult, SearchMatch } from "@petra/shared";

/** Parse frontmatter from content */
function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const yamlStr = match[1];
  const body = match[2];
  const frontmatter: Record<string, unknown> = {};

  for (const line of yamlStr.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[key] = value.slice(1, -1).split(",").map(s => s.trim());
    } else if (value) {
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

/** Default maximum file size to search (1MB) */
const DEFAULT_MAX_FILE_SIZE = 1 * 1024 * 1024;

/** Register search routes */
export function registerSearchRoutes(server: PetraServer, app: App): void {

  // POST /search - Full-text search
  server.route("POST", "/search", async (_req, res, _params, body) => {
    const { query, folder, limit = 20, caseSensitive = false, maxFileSize = DEFAULT_MAX_FILE_SIZE } = body as {
      query: string;
      folder?: string;
      limit?: number;
      caseSensitive?: boolean;
      maxFileSize?: number;
    };

    if (!query) {
      server.sendError(res, 400, "INVALID_PATH", "Query is required");
      return;
    }

    const searchQuery = caseSensitive ? query : query.toLowerCase();
    const files = app.vault.getMarkdownFiles();
    const results: SearchResult[] = [];

    for (const file of files) {
      if (folder && !file.path.startsWith(folder)) continue;
      if (results.length >= limit) break;

      // Check file size before reading to prevent memory issues
      const stat = await app.vault.adapter.stat(file.path);
      if (stat && stat.size > maxFileSize) {
        // Skip files that exceed the size limit
        continue;
      }

      const content = await app.vault.read(file);
      const { frontmatter, body } = parseFrontmatter(content);

      const matches: SearchMatch[] = [];

      // Search in content
      const lines = body.split("\n");
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const searchLine = caseSensitive ? line : line.toLowerCase();
        if (searchLine.includes(searchQuery)) {
          matches.push({ line: i + 1, text: line.trim() });
        }
      }

      // Search in frontmatter
      const fmStr = JSON.stringify(frontmatter);
      const searchFm = caseSensitive ? fmStr : fmStr.toLowerCase();
      if (searchFm.includes(searchQuery)) {
        matches.push({ line: 0, text: `[frontmatter] ${fmStr.slice(0, 100)}` });
      }

      if (matches.length > 0) {
        results.push({
          note: {
            path: file.path.replace(/\.md$/, ""),
            title: (frontmatter.title as string) || file.basename,
            tags: (frontmatter.tags as string[]) || [],
            created: frontmatter.created as string,
            modified: frontmatter.modified as string,
          },
          matches,
        });
      }
    }

    // Sort by match count
    results.sort((a, b) => b.matches.length - a.matches.length);

    server.sendJson(res, { ok: true, data: results });
  });
}
