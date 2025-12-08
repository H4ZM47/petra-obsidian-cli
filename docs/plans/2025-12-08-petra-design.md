# Petra: CLI & Plugin for Obsidian

> A command-line interface and Obsidian plugin enabling AI agents to interact with Obsidian vaults.

## Overview

**petra** is a TypeScript monorepo providing:
1. A CLI tool (`petra`) for vault management, note CRUD, search, and automation
2. An Obsidian plugin (`petra-bridge`) exposing a local HTTP API for rich operations

The primary use case is enabling AI agents to access and manipulate Obsidian vaults through tool-use commands.

## Architecture

```
petra/
├── packages/
│   ├── cli/          # Command-line tool (npm: petra)
│   ├── plugin/       # Obsidian plugin (petra-bridge)
│   └── shared/       # Shared types, constants, utilities
├── package.json      # Workspace root
└── tsconfig.json     # Shared TypeScript config
```

### Operating Modes

**File Mode (CLI alone):**
- CLI reads/writes markdown files directly in vault directories
- Works for CRUD, content search, listing notes, tag operations
- No Obsidian required

**Bridge Mode (CLI + Plugin):**
- Plugin exposes local HTTP API on `localhost:27182`
- CLI auto-detects and uses for rich operations
- Enables: backlinks, graph queries, link-aware moves, template execution

**Hybrid Behavior:**
- Commands try bridge mode first
- Fall back to file mode when possible
- Return clear error when operation requires bridge mode

### Authentication

- Plugin generates random token on first run
- Token stored at `~/.petra/token`
- CLI reads token, sends as `Authorization: Bearer <token>`
- `/health` endpoint exempt from auth

## CLI Design

### Command Structure

```bash
petra <resource> <action> [args] [flags]
```

### Global Flags

| Flag | Short | Description |
|------|-------|-------------|
| `--json` | `-j` | Output as JSON |
| `--quiet` | `-q` | Suppress non-error output |
| `--vault <path>` | | Override active vault |
| `--config <k>=<v>` | | One-off config override |

### Configuration

```bash
petra config set output json      # Default to JSON output
petra config set vault ~/vaults   # Set default vault
PETRA_OUTPUT=json                 # Environment variable override
```

### Resources & Actions

| Resource | Actions |
|----------|---------|
| `note` | `create`, `read`, `update`, `delete`, `list`, `search`, `move`, `backlinks`, `outlinks` |
| `vault` | `list`, `switch`, `create`, `backup`, `info` |
| `daily` | `create`, `open`, `list` |
| `template` | `list`, `run` |
| `graph` | `query`, `neighbors` |
| `tag` | `list`, `search`, `add`, `remove` |

### Example Commands

```bash
# Note operations
petra note create "Meeting Notes" --template=meeting
petra note read "Projects/Petra"
petra note update "Projects/Petra" --append "New section"
petra note delete "Old Note"
petra note list --tag=todo --limit=10
petra note search "API design" --json
petra note backlinks "Projects/Petra"
petra note move "Old/Path" "New/Path"

# Vault operations
petra vault list
petra vault switch work
petra vault info

# Daily notes
petra daily create
petra daily create --date=tomorrow
petra daily list --limit=7

# Graph operations
petra graph neighbors "Projects/Petra" --depth=2

# Tags
petra tag list
petra tag search project
```

## Plugin API Design

REST API on `localhost:27182`.

### Endpoints

```
GET  /health                     # Check plugin is running
GET  /vault                      # Current vault info

# Notes
GET    /notes                    # List notes (query: tag, folder, limit)
POST   /notes                    # Create note (body: {path, content, template?})
GET    /notes/:path              # Read note content + metadata
PUT    /notes/:path              # Update note (body: {content} or {append})
DELETE /notes/:path              # Delete note
POST   /notes/:path/move         # Move/rename (body: {newPath})

# Links & Graph
GET    /notes/:path/backlinks    # Notes linking to this note
GET    /notes/:path/outlinks     # Notes this note links to
POST   /graph/query              # Graph queries (body: {from, depth, filter})

# Search
POST   /search                   # Full-text search (body: {query, options})
GET    /tags                     # List all tags
GET    /tags/:tag/notes          # Notes with this tag

# Daily notes
POST   /daily                    # Create today's daily note
GET    /daily/:date              # Get daily note for date

# Templates
GET    /templates                # List available templates
POST   /templates/:name/run      # Run template (body: {destination, variables})
```

### Response Format

```json
{
  "ok": true,
  "data": { ... }
}
```

```json
{
  "ok": false,
  "error": { "code": "NOT_FOUND", "message": "Note not found" }
}
```

## File Mode Operations

### Vault Discovery

- Reads `~/.obsidian/obsidian.json` to find known vaults
- User can specify vault with `--vault` or `petra config set vault`

### Capabilities

| Operation | Implementation |
|-----------|----------------|
| `note create` | Write markdown file |
| `note read` | Read file, parse YAML frontmatter |
| `note update` | Read, modify, write file |
| `note delete` | Delete file (or move to `.trash`) |
| `note list` | Glob directory, parse frontmatter |
| `note search` | Text search through files |
| `note move` | Rename file (**cannot update links** - warns user) |
| `tag list` | Parse frontmatter + inline tags |
| `tag search` | Filter by parsed tags |
| `vault list` | Read obsidian.json |
| `daily create` | Use pattern from `.obsidian/daily-notes.json` |

### Limitations (Require Bridge)

- `backlinks` / `outlinks` — Needs Obsidian's link index
- `graph query` — Needs Obsidian's graph data
- `note move` with link updates — Obsidian handles link rewriting
- `template run` with Templater — Requires plugin integration

### Error Handling

```
Error: This operation requires Obsidian to be running with petra-bridge.
       Start Obsidian or use a file-mode alternative.
```

## Tooling

| Concern | Tool |
|---------|------|
| Package manager | Bun |
| Runtime | Bun |
| Bundler | `bun build` |
| Test runner | `bun test` |
| Type checking | `tsc --noEmit` |

### Project Structure

```
petra/
├── packages/
│   ├── cli/
│   │   ├── src/
│   │   │   ├── commands/       # note.ts, vault.ts, daily.ts, etc.
│   │   │   ├── lib/            # client.ts (API), files.ts (file ops)
│   │   │   └── index.ts        # Entry point
│   │   └── package.json        # name: "petra"
│   ├── plugin/
│   │   ├── src/
│   │   │   ├── api/            # HTTP server, routes
│   │   │   ├── services/       # Note, vault, graph services
│   │   │   └── main.ts         # Plugin entry
│   │   ├── manifest.json       # Obsidian plugin manifest
│   │   └── package.json        # name: "petra-bridge"
│   └── shared/
│       ├── src/
│       │   ├── types.ts        # Shared interfaces
│       │   ├── constants.ts    # Port, paths, etc.
│       │   └── errors.ts       # Error codes
│       └── package.json        # name: "@petra/shared"
├── bun.lockb
├── bunfig.toml                 # Optional Bun config
├── package.json                # Workspaces config
└── tsconfig.json
```

### Dependencies

**CLI:**
- `commander` — Argument parsing
- `chalk` — Terminal colors
- `ora` — Spinners
- `conf` — Config storage

**Plugin:**
- Obsidian API (built-in)
- HTTP server (lightweight, possibly built-in Bun.serve or hono)

**Shared:**
- Pure TypeScript types (no runtime dependencies)

## Implementation Phases

### Phase 1 — Foundation (MVP)

- Monorepo setup with Bun workspaces
- Shared types package
- CLI scaffolding with commander
- File-mode CRUD: `note create`, `read`, `update`, `delete`, `list`
- Vault discovery from `~/.obsidian/obsidian.json`
- Config system (`petra config set/get`)
- Output modes: pretty, JSON, quiet

### Phase 2 — File-Mode Search & Tags

- `note search` (content search across vault)
- `tag list`, `tag search`
- `note move` (with warning about links)
- `daily create` / `daily list`
- Frontmatter parsing

### Phase 3 — Plugin Bridge

- Obsidian plugin scaffolding (petra-bridge)
- HTTP server on localhost:27182
- Token-based auth
- Bridge-mode CRUD endpoints
- CLI auto-detection of bridge availability

### Phase 4 — Rich Operations

- `note backlinks`, `note outlinks`
- `graph query`, `graph neighbors`
- `template list`, `template run`
- Link-aware `note move` via bridge

### Phase 5 — Polish

- Plugin submission to Obsidian community registry
- npm publish for CLI
- Documentation
- Error messages tuned for AI agent consumption

## Distribution

**CLI:** `npm install -g petra`

**Plugin:**
- Manual install during development
- Obsidian community plugin registry when stable
