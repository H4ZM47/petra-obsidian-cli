# Petra

A command-line interface for Obsidian vaults, enabling AI agents and automation tools to interact with your notes.

## Overview

Petra consists of two components:

1. **Petra CLI** - Command-line tool for vault operations (create, read, update, delete notes, search, tags, daily notes)
2. **Petra Bridge** - Obsidian plugin that exposes an HTTP API for advanced operations (backlinks, graph queries, templates)

The CLI works standalone for basic file operations. For features requiring Obsidian's metadata (backlinks, link-aware moves, templates), the Bridge plugin must be running.

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime (v1.0+)
- [Obsidian](https://obsidian.md) (v1.4.0+ for Bridge plugin)

### CLI Installation

```bash
# Clone the repository
git clone https://github.com/petra-cli/petra.git
cd petra

# Install dependencies
bun install

# Build all packages
bun run build

# Link CLI globally
cd packages/cli
bun link
```

After linking, `petra` will be available globally:

```bash
petra --version
petra --help
```

### Plugin Installation

1. Build the plugin:
   ```bash
   cd packages/plugin
   bun run build
   ```

2. Copy to your Obsidian vault's plugins folder:
   ```bash
   # Replace /path/to/vault with your vault path
   mkdir -p /path/to/vault/.obsidian/plugins/petra-bridge
   cp dist/* /path/to/vault/.obsidian/plugins/petra-bridge/
   ```

3. Enable the plugin:
   - Open Obsidian
   - Go to Settings > Community plugins
   - Enable "Petra Bridge"

The plugin runs an HTTP server on `localhost:27182` when enabled.

## Configuration

### Set Default Vault

```bash
petra config set vault /path/to/your/vault
```

### Override Vault Per-Command

```bash
petra --vault /other/vault note list
```

### Authentication

The Bridge plugin generates a token at `~/.petra/token` on first run. The CLI reads this token automatically for authenticated requests.

## CLI Commands

### Notes

```bash
# Create a note
petra note create "Projects/my-project" --title "My Project" --tags "project,active"

# Read a note
petra note read "Projects/my-project"

# Update a note
petra note update "Projects/my-project" --append "New content here"

# Delete a note
petra note delete "Projects/my-project"
petra note delete "Projects/my-project" --trash  # Move to .trash instead

# List notes
petra note list
petra note list --folder "Projects" --limit 10

# Search notes
petra note search "keyword"
petra note search "keyword" --folder "Projects" --case-sensitive

# Move/rename a note
petra note move "old/path" "new/path"
```

### Tags

```bash
# List all tags with counts
petra tag list

# Find notes with a specific tag
petra tag search "project"
petra tag search "project" --exact  # Exact match only
```

### Daily Notes

```bash
# Create/open today's daily note
petra daily create
petra daily create --date "2024-01-15"
petra daily create --date "tomorrow"

# Get a specific daily note
petra daily get today
petra daily get yesterday
petra daily get 2024-01-15

# List recent daily notes
petra daily list
petra daily list --limit 14
```

### Bridge-Only Commands

These require the Petra Bridge plugin running in Obsidian:

```bash
# Backlinks - notes linking TO this note
petra note backlinks "Projects/my-project"

# Outlinks - notes this note links TO
petra note outlinks "Projects/my-project"

# Graph neighbors - connected notes
petra graph neighbors "Projects/my-project"
petra graph neighbors "Projects/my-project" --direction in  # Only incoming
petra graph neighbors "Projects/my-project" --depth 2

# Graph query - advanced traversal
petra graph query --from "Projects/my-project" --depth 3 --direction both
petra graph query --json  # Output as JSON for processing

# Templates
petra template list
petra template run "meeting-notes" "Meetings/2024-01-15" --var "attendees=Alice, Bob"
```

### Vault & Config

```bash
# Show current vault
petra vault show

# Set configuration
petra config set vault /path/to/vault
petra config get vault
```

## Global Options

```bash
-v, --vault <path>   Override vault path for this command
-j, --json           Output as JSON (useful for scripting)
-q, --quiet          Suppress non-error output
--help               Show help
--version            Show version
```

## HTTP API (Bridge)

When the Bridge plugin is running, these endpoints are available at `http://localhost:27182`:

### Health Check
```
GET /health
```

### Vault Info
```
GET /vault
```

### Notes
```
GET    /notes/:path        # Read note
POST   /notes/:path        # Create note
PUT    /notes/:path        # Update note
DELETE /notes/:path        # Delete note
GET    /notes/:path/backlinks  # Get backlinks
GET    /notes/:path/outlinks   # Get outlinks
```

### Search
```
POST /search
Body: { "query": "keyword", "folder": "optional", "limit": 20, "caseSensitive": false }
```

### Tags
```
GET /tags                  # List all tags with counts
GET /tags/:tag/notes       # Get notes with tag
```

### Daily Notes
```
POST /daily                # Create daily note
GET  /daily/:date          # Get daily note (date: YYYY-MM-DD, "today", "yesterday", "tomorrow")
GET  /daily                # List recent daily notes
```

### Graph
```
POST /graph/query          # Query link graph
GET  /graph/neighbors/:path  # Get immediate neighbors
```

### Templates
```
GET  /templates            # List available templates
POST /templates/:name/run  # Execute template
Body: { "destination": "path/to/new-note", "variables": { "key": "value" } }
```

All endpoints (except `/health`) require Bearer token authentication:
```
Authorization: Bearer <token from ~/.petra/token>
```

## Development

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run CLI in development
cd packages/cli
bun run dev -- note list

# Watch plugin for changes
cd packages/plugin
bun run dev

# Type check
bun run typecheck
```

### Project Structure

```
packages/
├── cli/           # Command-line interface
│   ├── src/
│   │   ├── commands/  # Command implementations
│   │   └── lib/       # Core library functions
│   └── package.json
├── plugin/        # Obsidian plugin
│   ├── src/
│   │   ├── routes/    # HTTP route handlers
│   │   ├── server.ts  # HTTP server
│   │   └── main.ts    # Plugin entry point
│   └── manifest.json
└── shared/        # Shared types and utilities
    └── src/
        ├── types.ts
        ├── constants.ts
        └── errors.ts
```

## License

MIT
