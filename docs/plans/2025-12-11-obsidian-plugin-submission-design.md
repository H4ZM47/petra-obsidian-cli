# Petra Bridge Plugin Submission Design

**Date:** 2025-12-11
**Status:** Approved

## Overview

Submit Petra Bridge plugin to the official Obsidian community plugins repository.

## Decisions

| Decision | Choice |
|----------|--------|
| Repository | Separate repo: `H4ZM47/petra-bridge` |
| Author | Alex Haslach |
| Shared code | Inline into plugin |
| Description | "HTTP API bridge for Petra CLI - enables AI agents to interact with your vault" |
| License | MIT |
| Release automation | GitHub Actions |

## Repository Structure

```
petra-bridge/
├── src/
│   ├── main.ts
│   ├── server.ts
│   ├── auth.ts
│   ├── settings.ts
│   ├── shared.ts          # Inlined types/constants
│   ├── types.d.ts
│   └── routes/
│       ├── index.ts
│       ├── notes.ts
│       ├── daily.ts
│       ├── search.ts
│       ├── tags.ts
│       ├── templates.ts
│       ├── links.ts
│       └── graph.ts
├── .github/
│   └── workflows/
│       └── release.yml
├── manifest.json
├── package.json
├── versions.json
├── styles.css
├── tsconfig.json
├── build.js
├── LICENSE
└── README.md
```

## Metadata Files

### manifest.json

```json
{
  "id": "petra-bridge",
  "name": "Petra Bridge",
  "version": "0.1.0",
  "minAppVersion": "1.4.0",
  "description": "HTTP API bridge for Petra CLI - enables AI agents to interact with your vault",
  "author": "Alex Haslach",
  "authorUrl": "https://github.com/H4ZM47",
  "isDesktopOnly": true
}
```

### versions.json

```json
{
  "0.1.0": "1.4.0"
}
```

### community-plugins.json entry

```json
{
  "id": "petra-bridge",
  "name": "Petra Bridge",
  "author": "Alex Haslach",
  "description": "HTTP API bridge for Petra CLI - enables AI agents to interact with your vault",
  "repo": "H4ZM47/petra-bridge"
}
```

## GitHub Actions Release Workflow

`.github/workflows/release.yml`:

```yaml
name: Release Obsidian Plugin

on:
  push:
    tags:
      - '*'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - run: bun install
      - run: bun run build

      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            dist/main.js
            dist/manifest.json
            dist/styles.css
```

## Implementation Phases

### Phase 1: Create Standalone Repository

1. Create `H4ZM47/petra-bridge` repo on GitHub
2. Initialize with plugin files (migrated from monorepo)
3. Inline shared types/constants into `src/shared.ts`
4. Update all imports from `@petra/shared` to `./shared`
5. Add LICENSE (MIT)
6. Add plugin-specific README
7. Add versions.json
8. Add GitHub Actions workflow

### Phase 2: Build & Test

1. Verify plugin builds standalone (`bun run build`)
2. Test in Obsidian (manual install to vault)
3. Verify HTTP server starts and endpoints work

### Phase 3: Release

1. Push code to GitHub
2. Create and push tag: `git tag 0.1.0 && git push --tags`
3. Verify GitHub Actions creates release with:
   - main.js
   - manifest.json
   - styles.css

### Phase 4: Submit to Community Plugins

1. Fork `obsidianmd/obsidian-releases`
2. Add entry to end of `community-plugins.json`
3. Create PR following submission checklist
4. Wait for Obsidian team review (typically 1-2 weeks)

## Code Changes Required

### shared.ts (new file)

Inline the following from `@petra/shared`:

**Constants:**
- `VERSION = "0.1.0"`
- `DEFAULT_PORT = 27182`
- `CONFIG_DIR = ".petra"`
- `TOKEN_FILE = "token"`

**Types:**
- `NoteFrontmatter`
- `Note`
- `NoteInfo`
- `ApiResponse<T>`
- `ApiError`
- `ErrorCode`
- `SearchMatch`
- `SearchResult`

### Import updates

All files importing from `@petra/shared` need updating:

| File | Current Import | New Import |
|------|---------------|------------|
| main.ts | `@petra/shared` | `./shared` |
| server.ts | `@petra/shared` | `./shared` |
| auth.ts | `@petra/shared` | `./shared` |
| settings.ts | `@petra/shared` | `./shared` |
| routes/*.ts | `@petra/shared` | `../shared` |

## Release Process (ongoing)

For future releases:

1. Update version in `manifest.json` and `package.json`
2. Add version mapping to `versions.json`
3. Commit changes
4. Create and push tag matching version
5. GitHub Actions handles the rest

## References

- [Obsidian Plugin Submission](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin)
- [Plugin Guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines)
- [obsidian-releases repo](https://github.com/obsidianmd/obsidian-releases)
