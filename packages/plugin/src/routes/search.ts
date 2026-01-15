// packages/plugin/src/routes/search.ts

import { App } from "obsidian";
import { PetraServer } from "../server";
import type { SearchResult, SearchMatch } from "@petra/shared";
import { parseFrontmatter } from "@petra/shared";

/** Register search routes */
export function registerSearchRoutes(server: PetraServer, app: App): void {

  // POST /search - Full-text search
  server.route("POST", "/search", async (_req, res, _params, body) => {
    const { query, folder, limit = 20, caseSensitive = false } = body as {
      query: string;
      folder?: string;
      limit?: number;
      caseSensitive?: boolean;
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

      const content = await app.vault.read(file);
      const { data: frontmatter, content: body } = parseFrontmatter(content);

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
