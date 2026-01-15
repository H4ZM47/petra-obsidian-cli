// packages/cache/src/schema.ts

import type { Database } from "bun:sqlite";

/** Initialize database schema */
export function initSchema(db: Database): void {
  // File index - tracks all markdown files and their metadata
  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      path TEXT PRIMARY KEY,
      mtime INTEGER NOT NULL,
      size INTEGER NOT NULL,
      title TEXT,
      created TEXT,
      modified TEXT,
      frontmatter TEXT
    )
  `);

  // Tags index - maps tags to file paths
  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      tag TEXT NOT NULL,
      path TEXT NOT NULL,
      PRIMARY KEY (tag, path),
      FOREIGN KEY (path) REFERENCES files(path) ON DELETE CASCADE
    )
  `);

  // Create index for tag lookups
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag)
  `);

  // Links index - stores outlinks and enables backlink queries
  db.run(`
    CREATE TABLE IF NOT EXISTS links (
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      type TEXT NOT NULL,
      PRIMARY KEY (source, target),
      FOREIGN KEY (source) REFERENCES files(path) ON DELETE CASCADE
    )
  `);

  // Create indexes for link lookups
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_links_source ON links(source)
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_links_target ON links(target)
  `);

  // Full-text search table using FTS5
  db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_content USING fts5(
      path,
      title,
      content,
      tokenize='porter unicode61'
    )
  `);

  // Metadata table for cache versioning
  db.run(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )
  `);

  // Set schema version
  db.run(`
    INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', '1')
  `);
}

/** Drop all tables (for cache reset) */
export function dropSchema(db: Database): void {
  db.run(`DROP TABLE IF EXISTS tags`);
  db.run(`DROP TABLE IF EXISTS links`);
  db.run(`DROP TABLE IF EXISTS fts_content`);
  db.run(`DROP TABLE IF EXISTS files`);
  db.run(`DROP TABLE IF EXISTS meta`);
}
