// packages/cache/src/index.ts

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { join, normalize } from "node:path";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { initSchema } from "./schema.js";
import { syncCache, type SyncStats } from "./sync.js";
import { searchContent } from "./search.js";
import type { NoteInfo, SearchResult } from "@petra/shared";
import { invalidPath } from "@petra/shared";

export { type SyncStats } from "./sync.js";
export { extractLinks, extractInlineTags } from "./links.js";

/** Validate a folder path for path traversal */
function validateFolder(folder: string | undefined): string | undefined {
  if (!folder) return undefined;

  const normalized = normalize(folder);
  // Reject any path containing '..' (path traversal attempt)
  if (normalized.includes("..")) {
    throw invalidPath(folder);
  }
  return normalized;
}

/** Get cache directory path */
function getCacheDir(): string {
  const dir = join(homedir(), ".petra", "cache");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** Generate a hash for the vault path */
function getVaultHash(vaultPath: string): string {
  return createHash("sha256").update(vaultPath).digest("hex").slice(0, 16);
}

/** Vault cache instance */
export class VaultCache {
  private db: Database;
  private vaultPath: string;

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
    const cacheDir = getCacheDir();
    const hash = getVaultHash(vaultPath);
    const dbPath = join(cacheDir, `${hash}.db`);

    this.db = new Database(dbPath);
    this.db.run("PRAGMA journal_mode = WAL");
    this.db.run("PRAGMA foreign_keys = ON");
    initSchema(this.db);
  }

  /** Sync cache with vault files, returns stats */
  sync(): SyncStats {
    return syncCache(this.db, this.vaultPath);
  }

  /** Search content using full-text search */
  searchContent(
    query: string,
    options: { folder?: string; limit?: number } = {}
  ): SearchResult[] {
    return searchContent(this.db, query, options);
  }

  /** Get all tags with their counts */
  getAllTags(): Map<string, number> {
    const rows = this.db
      .query(
        "SELECT tag, COUNT(*) as count FROM tags GROUP BY tag ORDER BY count DESC"
      )
      .all() as Array<{ tag: string; count: number }>;

    return new Map(rows.map((r) => [r.tag, r.count]));
  }

  /** Get notes that have a specific tag */
  getNotesByTag(
    tag: string,
    options: { exactMatch?: boolean; limit?: number } = {}
  ): NoteInfo[] {
    const { exactMatch = true, limit } = options;

    let sql = `
      SELECT DISTINCT f.path, f.title, f.created, f.modified, f.frontmatter
      FROM files f
      JOIN tags t ON f.path = t.path
      WHERE ${exactMatch ? "t.tag = ?" : "t.tag LIKE ?"}
      ORDER BY f.modified DESC NULLS LAST
    `;

    const params: unknown[] = [exactMatch ? tag : `%${tag}%`];

    if (limit) {
      sql += " LIMIT ?";
      params.push(limit);
    }

    const rows = this.db.query(sql).all(...params) as Array<{
      path: string;
      title: string;
      created: string | null;
      modified: string | null;
      frontmatter: string;
    }>;

    return rows.map((row) => {
      const fm = JSON.parse(row.frontmatter || "{}");
      return {
        path: row.path.replace(/\.md$/, ""),
        title: row.title,
        tags: Array.isArray(fm.tags) ? fm.tags : [],
        created: row.created || undefined,
        modified: row.modified || undefined,
      };
    });
  }

  /** Get outgoing links from a note */
  getOutlinks(path: string): Array<{ target: string; type: string }> {
    const normalizedPath = path.endsWith(".md") ? path : `${path}.md`;
    return this.db
      .query("SELECT target, type FROM links WHERE source = ?")
      .all(normalizedPath) as Array<{ target: string; type: string }>;
  }

  /** Get incoming links (backlinks) to a note */
  getBacklinks(path: string): Array<{ source: string; type: string }> {
    // Backlinks can match either the full path or just the filename
    const normalizedPath = path.endsWith(".md") ? path : `${path}.md`;
    const basename = normalizedPath.replace(/\.md$/, "").split("/").pop();

    return this.db
      .query(
        `SELECT source, type FROM links
         WHERE target = ? OR target = ? OR target = ?`
      )
      .all(normalizedPath, normalizedPath.replace(/\.md$/, ""), basename) as Array<{
      source: string;
      type: string;
    }>;
  }

  /** Get frontmatter for a note */
  getFrontmatter(path: string): Record<string, unknown> | null {
    const normalizedPath = path.endsWith(".md") ? path : `${path}.md`;
    const row = this.db
      .query("SELECT frontmatter FROM files WHERE path = ?")
      .get(normalizedPath) as { frontmatter: string } | null;

    if (!row) return null;
    return JSON.parse(row.frontmatter || "{}");
  }

  /** Get note info */
  getNoteInfo(path: string): NoteInfo | null {
    const normalizedPath = path.endsWith(".md") ? path : `${path}.md`;
    const row = this.db
      .query(
        "SELECT path, title, created, modified, frontmatter FROM files WHERE path = ?"
      )
      .get(normalizedPath) as {
      path: string;
      title: string;
      created: string | null;
      modified: string | null;
      frontmatter: string;
    } | null;

    if (!row) return null;

    const fm = JSON.parse(row.frontmatter || "{}");
    return {
      path: row.path.replace(/\.md$/, ""),
      title: row.title,
      tags: Array.isArray(fm.tags) ? fm.tags : [],
      created: row.created || undefined,
      modified: row.modified || undefined,
    };
  }

  /** List notes with optional filtering */
  listNotes(options: { folder?: string; limit?: number } = {}): NoteInfo[] {
    const folder = validateFolder(options.folder);
    const { limit } = options;

    let sql = `
      SELECT path, title, created, modified, frontmatter
      FROM files
    `;
    const params: unknown[] = [];

    if (folder) {
      sql += " WHERE path LIKE ?";
      params.push(`${folder}%`);
    }

    sql += " ORDER BY modified DESC NULLS LAST, created DESC NULLS LAST";

    if (limit) {
      sql += " LIMIT ?";
      params.push(limit);
    }

    const rows = this.db.query(sql).all(...params) as Array<{
      path: string;
      title: string;
      created: string | null;
      modified: string | null;
      frontmatter: string;
    }>;

    return rows.map((row) => {
      const fm = JSON.parse(row.frontmatter || "{}");
      return {
        path: row.path.replace(/\.md$/, ""),
        title: row.title,
        tags: Array.isArray(fm.tags) ? fm.tags : [],
        created: row.created || undefined,
        modified: row.modified || undefined,
      };
    });
  }

  /** Get cache statistics */
  getStats(): { totalNotes: number; totalTags: number; totalLinks: number } {
    const notes = this.db
      .query("SELECT COUNT(*) as count FROM files")
      .get() as { count: number };
    const tags = this.db
      .query("SELECT COUNT(DISTINCT tag) as count FROM tags")
      .get() as { count: number };
    const links = this.db
      .query("SELECT COUNT(*) as count FROM links")
      .get() as { count: number };

    return {
      totalNotes: notes.count,
      totalTags: tags.count,
      totalLinks: links.count,
    };
  }

  /** Close the database connection */
  close(): void {
    this.db.close();
  }
}
