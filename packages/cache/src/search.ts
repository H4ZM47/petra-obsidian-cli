// packages/cache/src/search.ts

import type { Database } from "bun:sqlite";
import { normalize } from "node:path";
import type { SearchResult, SearchMatch, NoteInfo } from "@petra/shared";
import { invalidPath } from "@petra/shared";

export interface SearchOptions {
  folder?: string;
  limit?: number;
}

/** Validate a folder path for path traversal */
function validateFolder(folder: string | undefined): string | undefined {
  if (!folder) return undefined;

  const normalized = normalize(folder);
  if (normalized.includes("..")) {
    throw invalidPath(folder);
  }
  return normalized;
}

/** Search content using FTS5 */
export function searchContent(
  db: Database,
  query: string,
  options: SearchOptions = {}
): SearchResult[] {
  const folder = validateFolder(options.folder);
  const limit = options.limit ?? 50;

  // Escape special FTS5 characters and create search query
  const escapedQuery = query
    .replace(/['"]/g, '""')
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term}"*`)
    .join(" OR ");

  if (!escapedQuery) return [];

  let sql = `
    SELECT
      f.path,
      f.title,
      f.created,
      f.modified,
      f.frontmatter,
      snippet(fts_content, 2, '>>>MATCH_START<<<', '>>>MATCH_END<<<', '...', 64) as snippet
    FROM fts_content
    JOIN files f ON f.path = fts_content.path
    WHERE fts_content MATCH ?
  `;

  const params: unknown[] = [escapedQuery];

  if (folder) {
    sql += ` AND f.path LIKE ?`;
    params.push(`${folder}%`);
  }

  sql += ` ORDER BY rank LIMIT ?`;
  params.push(limit);

  const stmt = db.prepare(sql);
  const rows = stmt.all(...params) as Array<{
    path: string;
    title: string;
    created: string | null;
    modified: string | null;
    frontmatter: string;
    snippet: string;
  }>;

  return rows.map((row) => {
    const frontmatter = JSON.parse(row.frontmatter || "{}");
    const tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];

    // Parse snippet to find matches
    const matches: SearchMatch[] = [];
    const snippetParts = row.snippet.split(">>>MATCH_START<<<");
    for (let i = 1; i < snippetParts.length; i++) {
      const endIdx = snippetParts[i].indexOf(">>>MATCH_END<<<");
      if (endIdx !== -1) {
        const matchText = snippetParts[i].slice(0, endIdx);
        const context = snippetParts[i - 1].slice(-30) + matchText + snippetParts[i].slice(endIdx + 15, endIdx + 45);
        matches.push({
          line: 0, // FTS doesn't give us line numbers
          text: context.trim(),
        });
      }
    }

    // Ensure at least one match entry
    if (matches.length === 0) {
      matches.push({ line: 0, text: row.snippet.replace(/>>>MATCH_(START|END)<<</g, "") });
    }

    const note: NoteInfo = {
      path: row.path.replace(/\.md$/, ""),
      title: row.title,
      tags,
      created: row.created || undefined,
      modified: row.modified || undefined,
    };

    return { note, matches };
  });
}
