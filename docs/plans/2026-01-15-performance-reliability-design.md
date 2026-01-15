# Performance & Reliability Optimization Design

## Overview

Optimize Petra CLI for AI agent automation workloads with SQLite-based caching and reliability improvements.

## Architecture

### New Package: `packages/cache`

SQLite-based cache layer storing:
- **File index**: path, mtime, size for change detection
- **Frontmatter**: parsed YAML as JSON
- **Tags index**: tag → note paths mapping
- **Links index**: outlinks and backlinks per note
- **FTS table**: SQLite full-text search for content

**Cache location:** `~/.petra/cache/<vault-hash>.db`

### Cache API

```typescript
class VaultCache {
  constructor(vaultPath: string)
  sync(): { added: number, modified: number, deleted: number }
  searchContent(query: string, options?): SearchResult[]
  getNotesByTag(tag: string): string[]
  getAllTags(): Map<string, number>
  getBacklinks(path: string): string[]
  getOutlinks(path: string): string[]
  getFrontmatter(path: string): Record<string, unknown>
  getNoteInfo(path: string): NoteInfo
  listNotes(options?): NoteInfo[]
}
```

### Invalidation Strategy

1. On operation, stat all files for mtimes (~10ms for 1000 files)
2. Compare against stored mtimes
3. Re-parse only changed files
4. Warm cache = sub-millisecond lookups

## Reliability Improvements

### 1. Request Body Limits

```typescript
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
```

### 2. Timing-Safe Auth

```typescript
import { timingSafeEqual } from 'crypto';
```

### 3. Consolidated Frontmatter Parsing

Single `parseFrontmatter()` in `packages/shared` using gray-matter.

### 4. Depth Limit Warnings

Return warnings when MAX_SCAN_DEPTH reached.

## Performance Improvements

### 1. Graph Traversal

Replace N² file reads with O(1) index lookups:
- Pre-index all outlinks and backlinks during sync
- Graph queries become pure index operations

### 2. Full-Text Search via SQLite FTS5

```sql
CREATE VIRTUAL TABLE fts_content USING fts5(
  path, title, content,
  tokenize='porter unicode61'
);
```

### 3. Parallel File Stats

```typescript
await Promise.all(files.map(f => stat(f)))
```

## File Changes

### New Files
- `packages/cache/src/index.ts` - VaultCache class
- `packages/cache/src/schema.ts` - SQLite tables
- `packages/cache/src/sync.ts` - File scanning
- `packages/cache/src/search.ts` - FTS queries
- `packages/cache/src/links.ts` - Link extraction
- `packages/cache/package.json`
- `packages/shared/src/frontmatter.ts` - Consolidated parser

### Modified Files
- `packages/cli/src/lib/notes.ts` - Use cache
- `packages/cli/src/lib/tags.ts` - Use cache
- `packages/plugin/src/server.ts` - Body limits, timing-safe auth
- `packages/plugin/src/routes/search.ts` - Use shared parser
- `packages/plugin/src/routes/graph.ts` - Use cache when available
- `packages/shared/package.json` - Add gray-matter

## Dependencies

- `better-sqlite3` in packages/cache (synchronous, fast)
- `gray-matter` in packages/shared (already used in CLI)
