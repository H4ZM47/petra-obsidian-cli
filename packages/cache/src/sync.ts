// packages/cache/src/sync.ts

import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import type { Database } from "bun:sqlite";
import { parseFrontmatter } from "@petra/shared";
import { extractLinks, extractInlineTags } from "./links.js";

const MAX_SCAN_DEPTH = 20;

export interface SyncStats {
  added: number;
  modified: number;
  deleted: number;
  unchanged: number;
  totalTime: number;
}

interface FileEntry {
  path: string;
  mtime: number;
  size: number;
}

/** Scan vault directory for markdown files */
function scanVault(vaultPath: string): FileEntry[] {
  const files: FileEntry[] = [];

  function scan(dir: string, depth: number): void {
    if (depth > MAX_SCAN_DEPTH) return;
    if (!existsSync(dir)) return;

    const entries = readdirSync(dir);
    for (const entry of entries) {
      if (entry.startsWith(".")) continue;

      const fullPath = join(dir, entry);
      let stat;
      try {
        stat = statSync(fullPath);
      } catch {
        continue;
      }

      if (stat.isSymbolicLink()) continue;

      if (stat.isDirectory()) {
        scan(fullPath, depth + 1);
      } else if (entry.endsWith(".md")) {
        const relativePath = relative(vaultPath, fullPath);
        files.push({
          path: relativePath,
          mtime: Math.floor(stat.mtimeMs),
          size: stat.size,
        });
      }
    }
  }

  scan(vaultPath, 0);
  return files;
}

/** Sync cache with vault files */
export function syncCache(
  db: Database,
  vaultPath: string
): SyncStats {
  const startTime = Date.now();
  const stats: SyncStats = {
    added: 0,
    modified: 0,
    deleted: 0,
    unchanged: 0,
    totalTime: 0,
  };

  // Get current files on disk
  const diskFiles = scanVault(vaultPath);
  const diskPaths = new Set(diskFiles.map((f) => f.path));

  // Get cached files
  const cachedFiles = db
    .query("SELECT path, mtime FROM files")
    .all() as Array<{ path: string; mtime: number }>;
  const cachedMap = new Map(cachedFiles.map((f) => [f.path, f.mtime]));

  // Prepare statements
  const insertFile = db.prepare(`
    INSERT OR REPLACE INTO files (path, mtime, size, title, created, modified, frontmatter)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const deleteFile = db.prepare("DELETE FROM files WHERE path = ?");
  const deleteTags = db.prepare("DELETE FROM tags WHERE path = ?");
  const insertTag = db.prepare("INSERT OR IGNORE INTO tags (tag, path) VALUES (?, ?)");
  const deleteLinks = db.prepare("DELETE FROM links WHERE source = ?");
  const insertLink = db.prepare("INSERT OR IGNORE INTO links (source, target, type) VALUES (?, ?, ?)");
  const deleteFts = db.prepare("DELETE FROM fts_content WHERE path = ?");
  const insertFts = db.prepare("INSERT INTO fts_content (path, title, content) VALUES (?, ?, ?)");

  // Process files in a transaction for speed
  const processFile = (file: FileEntry) => {
    const fullPath = join(vaultPath, file.path);
    let raw: string;
    try {
      raw = readFileSync(fullPath, "utf-8");
    } catch {
      return;
    }

    const { data: frontmatter, content } = parseFrontmatter(raw);
    const title = (frontmatter.title as string) || file.path.replace(/\.md$/, "").split("/").pop() || "";
    const created = frontmatter.created as string | undefined;
    const modified = frontmatter.modified as string | undefined;

    // Insert/update file record
    insertFile.run(
      file.path,
      file.mtime,
      file.size,
      title,
      created,
      modified,
      JSON.stringify(frontmatter)
    );

    // Update tags
    deleteTags.run(file.path);
    const fmTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
    const inlineTags = extractInlineTags(content);
    const allTags = new Set([...fmTags.map(String), ...inlineTags]);
    for (const tag of allTags) {
      insertTag.run(tag, file.path);
    }

    // Update links
    deleteLinks.run(file.path);
    const links = extractLinks(content);
    for (const link of links) {
      insertLink.run(file.path, link.target, link.type);
    }

    // Update FTS
    deleteFts.run(file.path);
    insertFts.run(file.path, title, content);
  };

  // Process files that need updating
  const transaction = db.transaction(() => {
    // Find files to add/update
    for (const file of diskFiles) {
      const cachedMtime = cachedMap.get(file.path);
      if (cachedMtime === undefined) {
        processFile(file);
        stats.added++;
      } else if (cachedMtime !== file.mtime) {
        processFile(file);
        stats.modified++;
      } else {
        stats.unchanged++;
      }
    }

    // Find files to delete
    for (const cached of cachedFiles) {
      if (!diskPaths.has(cached.path)) {
        deleteTags.run(cached.path);
        deleteLinks.run(cached.path);
        deleteFts.run(cached.path);
        deleteFile.run(cached.path);
        stats.deleted++;
      }
    }
  });

  transaction();

  stats.totalTime = Date.now() - startTime;
  return stats;
}
