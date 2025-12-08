# Petra - Obsidian CLI

## Project Overview

Petra is a CLI tool and Obsidian plugin that enables AI agents to interact with Obsidian vaults. It provides:

- **CLI** (`packages/cli`): Command-line interface for note operations
- **Plugin** (`packages/plugin`): Obsidian plugin exposing HTTP API for advanced features
- **Shared** (`packages/shared`): Common types, constants, and utilities

## Using Petra in This Project

### For Vault Operations

When you need to work with an Obsidian vault (read notes, search, create content), use the `knowledge-manager` subagent or invoke the `obsidian-vault-management` skill.

```bash
# Quick operations
petra note search "query"
petra note read "path/to/note"
petra note create "path" --title "Title" --content "Content"

# Bridge operations (require Obsidian running)
petra note backlinks "path"
petra graph neighbors "path"
```

### Available Subagents

- **knowledge-manager**: Use for any Obsidian vault operations, PKM workflows, or knowledge management tasks

### Available Skills

- **obsidian-vault-management**: Comprehensive guide for Petra CLI usage patterns

### Slash Commands

- `/vault <operation>`: Quick access to vault operations

## Development Guidelines

### Package Structure

```
packages/
├── cli/           # Bun-based CLI (Commander.js)
├── plugin/        # Obsidian plugin (esbuild)
└── shared/        # Shared TypeScript types
```

### Building

```bash
bun install
bun run build
```

### Testing Petra Commands

```bash
cd packages/cli
bun run dev -- note list
bun run dev -- note search "test"
```

### Plugin Development

The plugin runs an HTTP server on port 27182. Test endpoints:

```bash
# Health check (no auth)
curl http://localhost:27182/health

# Authenticated request
TOKEN=$(cat ~/.petra/token)
curl -H "Authorization: Bearer $TOKEN" http://localhost:27182/vault
```

## Issue Tracking

This project uses Beads for issue tracking. Check `.beads/` directory.

```bash
bd list              # List issues
bd ready             # Show ready-to-work items
bd show <id>         # Issue details
```
