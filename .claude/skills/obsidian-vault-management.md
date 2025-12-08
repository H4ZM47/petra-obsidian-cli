---
name: obsidian-vault-management
description: Use when working with Obsidian vaults - reading, writing, searching notes, managing knowledge, or when the user mentions Obsidian, notes, vault, PKM, or knowledge management
---

# Obsidian Vault Management with Petra

## Overview

This skill enables AI agents to interact with Obsidian vaults through the Petra CLI and Bridge plugin. Use this whenever you need to read, write, search, or analyze notes in an Obsidian vault.

## When to Use

Activate this skill when:
- User asks about notes, knowledge, or information in their vault
- User wants to create, update, or organize notes
- User needs to search across their knowledge base
- User mentions Obsidian, PKM, Zettelkasten, or knowledge management
- You need to store research findings or documentation
- You need to explore connections between notes (backlinks, graph)

## Prerequisites Check

Before using Petra commands, verify the setup:

```bash
# Check if petra is available
petra --version

# Check configured vault
petra vault show

# If no vault configured, set one:
petra config set vault /path/to/vault
```

## Core Operations

### Reading Notes

```bash
# Read a specific note
petra note read "path/to/note"

# List notes in vault
petra note list
petra note list --folder "Projects" --limit 20

# Search for content
petra note search "keyword"
petra note search "exact phrase" --case-sensitive
```

### Writing Notes

```bash
# Create a new note
petra note create "path/to/note" --title "Note Title" --content "Initial content"

# Create with tags
petra note create "Projects/new-project" --title "Project Name" --tags "project,active"

# Update existing note
petra note update "path/to/note" --append "Additional content"
petra note update "path/to/note" --content "Replace all content"
```

### Organizing Notes

```bash
# Move/rename a note
petra note move "old/path" "new/path"

# Delete a note (to trash)
petra note delete "path/to/note" --trash

# Work with tags
petra tag list
petra tag search "project"
```

### Daily Notes

```bash
# Create today's daily note
petra daily create

# Create for specific date
petra daily create --date "2024-01-15"
petra daily create --date "tomorrow"

# Read daily notes
petra daily get today
petra daily get yesterday
petra daily list --limit 7
```

## Bridge Operations (Requires Obsidian Running)

These commands require the Petra Bridge plugin to be enabled in Obsidian:

### Link Analysis

```bash
# What links TO this note?
petra note backlinks "Projects/my-project"

# What does this note link TO?
petra note outlinks "Projects/my-project"
```

### Graph Exploration

```bash
# Find connected notes
petra graph neighbors "Projects/my-project"
petra graph neighbors "Projects/my-project" --depth 2 --direction both

# Query the knowledge graph
petra graph query --from "Projects/my-project" --depth 3
petra graph query --json  # For programmatic processing
```

### Templates

```bash
# List available templates
petra template list

# Create note from template
petra template run "meeting-notes" "Meetings/2024-01-15-standup"
petra template run "project" "Projects/new-idea" --var "status=planning"
```

## Workflow Patterns

### Research Capture

When gathering information for the user:

1. Create a research note:
   ```bash
   petra note create "Research/topic-name" --title "Research: Topic" --tags "research,in-progress"
   ```

2. Append findings as you discover them:
   ```bash
   petra note update "Research/topic-name" --append "## Finding 1\n\nDetails here..."
   ```

3. Link to related notes by including `[[Other Note]]` in content

### Knowledge Exploration

When user asks about their knowledge base:

1. Search for relevant content:
   ```bash
   petra note search "topic keyword"
   ```

2. Explore connections (if bridge available):
   ```bash
   petra note backlinks "relevant-note"
   petra graph neighbors "relevant-note" --depth 2
   ```

3. Synthesize findings from multiple notes

### Daily Journaling Support

When user wants to journal or log:

1. Get or create today's daily note:
   ```bash
   petra daily create
   ```

2. Append entries:
   ```bash
   petra note update "2024-01-15" --append "## 10:30 AM\n\nNote content..."
   ```

### Project Documentation

When documenting a project:

1. Create from template if available:
   ```bash
   petra template run "project" "Projects/project-name"
   ```

2. Or create manually with structure:
   ```bash
   petra note create "Projects/project-name" --title "Project Name" --tags "project" --content "## Overview\n\n## Goals\n\n## Progress\n"
   ```

## Error Handling

### Bridge Not Available

If bridge commands fail with connection errors:
- Ensure Obsidian is running
- Check that Petra Bridge plugin is enabled
- The bridge runs on localhost:27182

Fall back to file-based operations (note create/read/update/list/search) which work without the bridge.

### Note Not Found

If a note doesn't exist:
- Check the path (no .md extension needed)
- Use `petra note list --folder "parent"` to find correct path
- Create the note if appropriate

### Vault Not Configured

If vault commands fail:
```bash
petra config set vault /path/to/vault
```

## Output Formats

For programmatic processing, use JSON output:

```bash
petra note list --json
petra note search "query" --json
petra graph query --json
```

## Best Practices

1. **Use descriptive paths**: `Projects/project-name` not `note1`
2. **Tag consistently**: Use tags for cross-cutting concerns
3. **Link liberally**: Use `[[wikilinks]]` to connect ideas
4. **Prefer append over replace**: Preserve existing content when adding
5. **Use templates**: Consistent structure aids retrieval
6. **Check before creating**: Search first to avoid duplicates

## Red Flags

- Creating notes without checking if similar content exists
- Overwriting notes without reading them first
- Ignoring connection opportunities (backlinks, tags)
- Using generic paths like "note" or "untitled"
- Not using the bridge when Obsidian-specific features are needed
