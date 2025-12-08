# Phase 1: Foundation (MVP) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a working CLI that can perform file-mode CRUD operations on Obsidian notes.

**Architecture:** Bun monorepo with three packages (cli, plugin, shared). CLI uses commander for arg parsing, directly reads/writes markdown files in vaults discovered from Obsidian's config.

**Tech Stack:** Bun, TypeScript, Commander, Chalk, gray-matter (frontmatter parsing)

---

## Task 1: Set up Bun monorepo with workspaces (petra-13w)

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `packages/cli/package.json`
- Create: `packages/plugin/package.json`
- Create: `packages/shared/package.json`
- Create: `pnpm-workspace.yaml` (Bun uses this format)

**Step 1: Create root package.json**

```json
{
  "name": "petra-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "build": "bun run --filter '*' build",
    "test": "bun run --filter '*' test",
    "typecheck": "tsc --noEmit"
  }
}
```

**Step 2: Create root tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create packages/shared/package.json**

```json
{
  "name": "@petra/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  }
}
```

**Step 4: Create packages/shared/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

**Step 5: Create packages/cli/package.json**

```json
{
  "name": "petra",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "petra": "./dist/index.js"
  },
  "scripts": {
    "build": "bun build src/index.ts --outdir dist --target node",
    "dev": "bun run src/index.ts",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@petra/shared": "workspace:*",
    "commander": "^12.1.0",
    "chalk": "^5.3.0",
    "gray-matter": "^4.0.3"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0"
  }
}
```

**Step 6: Create packages/cli/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

**Step 7: Create packages/plugin/package.json**

```json
{
  "name": "petra-bridge",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/main.js",
  "scripts": {
    "build": "bun build src/main.ts --outdir dist --target browser --external:obsidian",
    "dev": "bun build src/main.ts --outdir dist --target browser --external:obsidian --watch",
    "typecheck": "tsc --noEmit",
    "test": "bun test"
  },
  "dependencies": {
    "@petra/shared": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "obsidian": "^1.5.0",
    "typescript": "^5.3.0"
  }
}
```

**Step 8: Create packages/plugin/tsconfig.json**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "lib": ["ES2022", "DOM"]
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

**Step 9: Create placeholder source files**

`packages/shared/src/index.ts`:
```typescript
export const VERSION = "0.1.0";
```

`packages/cli/src/index.ts`:
```typescript
#!/usr/bin/env node
console.log("petra CLI");
```

`packages/plugin/src/main.ts`:
```typescript
import { Plugin } from "obsidian";

export default class PetraBridge extends Plugin {
  async onload() {
    console.log("petra-bridge loaded");
  }
}
```

**Step 10: Install dependencies**

Run: `bun install`

**Step 11: Verify setup**

Run: `bun run packages/cli/src/index.ts`
Expected: `petra CLI`

**Step 12: Commit**

```bash
git add -A
git commit -m "feat: set up Bun monorepo with workspaces"
```

---

## Task 2: Create shared types package (petra-vjs)

**Files:**
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/errors.ts`
- Modify: `packages/shared/src/index.ts`

**Step 1: Create types.ts**

```typescript
// packages/shared/src/types.ts

/** Frontmatter metadata from a note */
export interface NoteFrontmatter {
  title?: string;
  tags?: string[];
  aliases?: string[];
  created?: string;
  modified?: string;
  [key: string]: unknown;
}

/** A note with its content and metadata */
export interface Note {
  /** Path relative to vault root, without .md extension */
  path: string;
  /** Note title (from frontmatter or filename) */
  title: string;
  /** Raw markdown content (without frontmatter) */
  content: string;
  /** Parsed frontmatter */
  frontmatter: NoteFrontmatter;
  /** Full raw content including frontmatter */
  raw: string;
}

/** Minimal note info for listings */
export interface NoteInfo {
  path: string;
  title: string;
  tags: string[];
  created?: string;
  modified?: string;
}

/** Obsidian vault info */
export interface Vault {
  /** Vault identifier */
  id: string;
  /** Display name */
  name: string;
  /** Absolute path to vault directory */
  path: string;
  /** Whether this is the currently active vault */
  active?: boolean;
}

/** API response wrapper */
export interface ApiResponse<T> {
  ok: true;
  data: T;
}

/** API error response */
export interface ApiError {
  ok: false;
  error: {
    code: ErrorCode;
    message: string;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

/** Error codes */
export type ErrorCode =
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "INVALID_PATH"
  | "VAULT_NOT_SET"
  | "BRIDGE_UNAVAILABLE"
  | "AUTH_REQUIRED"
  | "AUTH_INVALID"
  | "INTERNAL_ERROR";

/** CLI output format */
export type OutputFormat = "pretty" | "json" | "quiet";

/** CLI global options */
export interface GlobalOptions {
  json?: boolean;
  quiet?: boolean;
  vault?: string;
}
```

**Step 2: Create constants.ts**

```typescript
// packages/shared/src/constants.ts

/** Default port for petra-bridge HTTP server */
export const DEFAULT_PORT = 27182;

/** Config directory path */
export const CONFIG_DIR = ".petra";

/** Token file name */
export const TOKEN_FILE = "token";

/** Config file name */
export const CONFIG_FILE = "config.json";

/** Obsidian config path (relative to home) */
export const OBSIDIAN_CONFIG_PATH = ".obsidian/obsidian.json";

/** Default trash folder name */
export const TRASH_FOLDER = ".trash";
```

**Step 3: Create errors.ts**

```typescript
// packages/shared/src/errors.ts

import type { ErrorCode } from "./types.js";

export class PetraError extends Error {
  constructor(
    public code: ErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PetraError";
  }
}

export function notFound(resource: string): PetraError {
  return new PetraError("NOT_FOUND", `${resource} not found`);
}

export function alreadyExists(resource: string): PetraError {
  return new PetraError("ALREADY_EXISTS", `${resource} already exists`);
}

export function invalidPath(path: string): PetraError {
  return new PetraError("INVALID_PATH", `Invalid path: ${path}`);
}

export function vaultNotSet(): PetraError {
  return new PetraError(
    "VAULT_NOT_SET",
    "No vault configured. Use 'petra vault switch <path>' or --vault flag."
  );
}

export function bridgeUnavailable(): PetraError {
  return new PetraError(
    "BRIDGE_UNAVAILABLE",
    "This operation requires Obsidian to be running with petra-bridge.\nStart Obsidian or use a file-mode alternative."
  );
}
```

**Step 4: Update index.ts to export everything**

```typescript
// packages/shared/src/index.ts

export * from "./types.js";
export * from "./constants.js";
export * from "./errors.js";

export const VERSION = "0.1.0";
```

**Step 5: Verify types compile**

Run: `cd packages/shared && bun run typecheck`
Expected: No errors

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add shared types, constants, and error utilities"
```

---

## Task 3: Scaffold CLI with commander (petra-d30)

**Files:**
- Create: `packages/cli/src/commands/index.ts`
- Modify: `packages/cli/src/index.ts`

**Step 1: Create command registry**

```typescript
// packages/cli/src/commands/index.ts

import { Command } from "commander";

export function registerCommands(program: Command): void {
  // Note commands
  const note = program
    .command("note")
    .description("Manage notes");

  note
    .command("create <path>")
    .description("Create a new note")
    .option("-t, --template <name>", "Use a template")
    .option("-c, --content <content>", "Initial content")
    .action(async (path, options) => {
      console.log("note create", path, options);
    });

  note
    .command("read <path>")
    .description("Read a note")
    .action(async (path) => {
      console.log("note read", path);
    });

  note
    .command("update <path>")
    .description("Update a note")
    .option("-c, --content <content>", "New content")
    .option("-a, --append <content>", "Append content")
    .action(async (path, options) => {
      console.log("note update", path, options);
    });

  note
    .command("delete <path>")
    .description("Delete a note")
    .option("--trash", "Move to trash instead of permanent delete")
    .action(async (path, options) => {
      console.log("note delete", path, options);
    });

  note
    .command("list")
    .description("List notes")
    .option("-f, --folder <path>", "Filter by folder")
    .option("-l, --limit <n>", "Limit results", parseInt)
    .action(async (options) => {
      console.log("note list", options);
    });

  // Vault commands
  const vault = program
    .command("vault")
    .description("Manage vaults");

  vault
    .command("list")
    .description("List available vaults")
    .action(async () => {
      console.log("vault list");
    });

  vault
    .command("switch <path>")
    .description("Switch active vault")
    .action(async (path) => {
      console.log("vault switch", path);
    });

  vault
    .command("info")
    .description("Show current vault info")
    .action(async () => {
      console.log("vault info");
    });

  // Config commands
  const config = program
    .command("config")
    .description("Manage configuration");

  config
    .command("set <key> <value>")
    .description("Set a config value")
    .action(async (key, value) => {
      console.log("config set", key, value);
    });

  config
    .command("get <key>")
    .description("Get a config value")
    .action(async (key) => {
      console.log("config get", key);
    });
}
```

**Step 2: Update CLI entry point**

```typescript
// packages/cli/src/index.ts
#!/usr/bin/env node

import { Command } from "commander";
import { VERSION } from "@petra/shared";
import { registerCommands } from "./commands/index.js";

const program = new Command();

program
  .name("petra")
  .description("CLI for Obsidian vaults")
  .version(VERSION)
  .option("-j, --json", "Output as JSON")
  .option("-q, --quiet", "Suppress non-error output")
  .option("-v, --vault <path>", "Override vault path");

registerCommands(program);

program.parse();
```

**Step 3: Test CLI runs**

Run: `bun run packages/cli/src/index.ts --help`
Expected: Shows help with all commands

Run: `bun run packages/cli/src/index.ts note --help`
Expected: Shows note subcommands

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: scaffold CLI with commander and command structure"
```

---

## Task 4: Implement config system (petra-s3b)

**Files:**
- Create: `packages/cli/src/lib/config.ts`
- Create: `packages/cli/src/commands/config.ts`
- Modify: `packages/cli/src/commands/index.ts`

**Step 1: Create config library**

```typescript
// packages/cli/src/lib/config.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR, CONFIG_FILE } from "@petra/shared";
import type { OutputFormat } from "@petra/shared";

export interface PetraConfig {
  vault?: string;
  output?: OutputFormat;
}

const CONFIG_PATH = join(homedir(), CONFIG_DIR, CONFIG_FILE);

function ensureConfigDir(): void {
  const dir = join(homedir(), CONFIG_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadConfig(): PetraConfig {
  if (!existsSync(CONFIG_PATH)) {
    return {};
  }
  try {
    const content = readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function saveConfig(config: PetraConfig): void {
  ensureConfigDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function getConfigValue(key: string): unknown {
  const config = loadConfig();
  return config[key as keyof PetraConfig];
}

export function setConfigValue(key: string, value: string): void {
  const config = loadConfig();

  // Type coercion for known keys
  if (key === "output" && !["pretty", "json", "quiet"].includes(value)) {
    throw new Error(`Invalid output format: ${value}. Use: pretty, json, quiet`);
  }

  (config as Record<string, unknown>)[key] = value;
  saveConfig(config);
}

/** Get effective config value considering env vars and CLI flags */
export function getEffectiveValue<T>(
  key: string,
  cliValue: T | undefined,
  envKey: string
): T | undefined {
  // Priority: CLI flag > env var > config file
  if (cliValue !== undefined) return cliValue;

  const envValue = process.env[envKey];
  if (envValue !== undefined) return envValue as T;

  return getConfigValue(key) as T | undefined;
}
```

**Step 2: Create config commands**

```typescript
// packages/cli/src/commands/config.ts

import { Command } from "commander";
import chalk from "chalk";
import { getConfigValue, setConfigValue, loadConfig } from "../lib/config.js";

export function configCommands(parent: Command): void {
  const config = parent
    .command("config")
    .description("Manage configuration");

  config
    .command("set <key> <value>")
    .description("Set a config value")
    .action((key, value) => {
      try {
        setConfigValue(key, value);
        console.log(chalk.green(`Set ${key} = ${value}`));
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });

  config
    .command("get <key>")
    .description("Get a config value")
    .action((key) => {
      const value = getConfigValue(key);
      if (value === undefined) {
        console.log(chalk.dim("(not set)"));
      } else {
        console.log(value);
      }
    });

  config
    .command("list")
    .description("Show all config values")
    .action(() => {
      const cfg = loadConfig();
      if (Object.keys(cfg).length === 0) {
        console.log(chalk.dim("No configuration set"));
      } else {
        for (const [key, value] of Object.entries(cfg)) {
          console.log(`${key}: ${value}`);
        }
      }
    });

  config
    .command("path")
    .description("Show config file path")
    .action(() => {
      const { homedir } = require("node:os");
      const { join } = require("node:path");
      console.log(join(homedir(), ".petra", "config.json"));
    });
}
```

**Step 3: Update command registry**

```typescript
// packages/cli/src/commands/index.ts

import { Command } from "commander";
import { configCommands } from "./config.js";

export function registerCommands(program: Command): void {
  // Note commands (placeholder for now)
  const note = program
    .command("note")
    .description("Manage notes");

  note
    .command("create <path>")
    .description("Create a new note")
    .option("-t, --template <name>", "Use a template")
    .option("-c, --content <content>", "Initial content")
    .action(async (path, options) => {
      console.log("note create", path, options);
    });

  note
    .command("read <path>")
    .description("Read a note")
    .action(async (path) => {
      console.log("note read", path);
    });

  note
    .command("update <path>")
    .description("Update a note")
    .option("-c, --content <content>", "New content")
    .option("-a, --append <content>", "Append content")
    .action(async (path, options) => {
      console.log("note update", path, options);
    });

  note
    .command("delete <path>")
    .description("Delete a note")
    .option("--trash", "Move to trash instead of permanent delete")
    .action(async (path, options) => {
      console.log("note delete", path, options);
    });

  note
    .command("list")
    .description("List notes")
    .option("-f, --folder <path>", "Filter by folder")
    .option("-l, --limit <n>", "Limit results", parseInt)
    .action(async (options) => {
      console.log("note list", options);
    });

  // Vault commands (placeholder for now)
  const vault = program
    .command("vault")
    .description("Manage vaults");

  vault
    .command("list")
    .description("List available vaults")
    .action(async () => {
      console.log("vault list");
    });

  vault
    .command("switch <path>")
    .description("Switch active vault")
    .action(async (path) => {
      console.log("vault switch", path);
    });

  vault
    .command("info")
    .description("Show current vault info")
    .action(async () => {
      console.log("vault info");
    });

  // Config commands
  configCommands(program);
}
```

**Step 4: Test config commands**

Run: `bun run packages/cli/src/index.ts config set vault ~/my-vault`
Expected: `Set vault = ~/my-vault`

Run: `bun run packages/cli/src/index.ts config get vault`
Expected: `~/my-vault`

Run: `bun run packages/cli/src/index.ts config list`
Expected: Shows all config values

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement config system with set/get/list commands"
```

---

## Task 5: Implement vault discovery (petra-jad)

**Files:**
- Create: `packages/cli/src/lib/vault.ts`
- Create: `packages/cli/src/commands/vault.ts`
- Modify: `packages/cli/src/commands/index.ts`

**Step 1: Create vault library**

```typescript
// packages/cli/src/lib/vault.ts

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import { OBSIDIAN_CONFIG_PATH } from "@petra/shared";
import type { Vault } from "@petra/shared";
import { notFound, vaultNotSet } from "@petra/shared";
import { getConfigValue, setConfigValue } from "./config.js";

interface ObsidianConfig {
  vaults: Record<string, { path: string; ts: number }>;
}

/** Get all vaults known to Obsidian */
export function getObsidianVaults(): Vault[] {
  const configPath = join(homedir(), OBSIDIAN_CONFIG_PATH);

  if (!existsSync(configPath)) {
    return [];
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config: ObsidianConfig = JSON.parse(content);
    const activeVault = getConfigValue("vault") as string | undefined;

    return Object.entries(config.vaults || {}).map(([id, vault]) => ({
      id,
      name: basename(vault.path),
      path: vault.path,
      active: vault.path === activeVault,
    }));
  } catch {
    return [];
  }
}

/** Get the currently active vault */
export function getActiveVault(): Vault | undefined {
  const vaultPath = getConfigValue("vault") as string | undefined;

  if (!vaultPath) {
    // Try to find default from Obsidian
    const vaults = getObsidianVaults();
    if (vaults.length === 1) {
      return vaults[0];
    }
    return undefined;
  }

  // Check if it's a known vault
  const vaults = getObsidianVaults();
  const known = vaults.find(v => v.path === vaultPath);
  if (known) {
    return { ...known, active: true };
  }

  // Custom path, verify it exists
  if (!existsSync(vaultPath)) {
    return undefined;
  }

  return {
    id: "custom",
    name: basename(vaultPath),
    path: vaultPath,
    active: true,
  };
}

/** Get vault or throw if not set */
export function requireVault(): Vault {
  const vault = getActiveVault();
  if (!vault) {
    throw vaultNotSet();
  }
  return vault;
}

/** Switch to a different vault */
export function switchVault(pathOrName: string): Vault {
  // First check if it's a known vault by name
  const vaults = getObsidianVaults();
  const byName = vaults.find(v => v.name === pathOrName);
  if (byName) {
    setConfigValue("vault", byName.path);
    return { ...byName, active: true };
  }

  // Check if it's a known vault by path
  const byPath = vaults.find(v => v.path === pathOrName);
  if (byPath) {
    setConfigValue("vault", byPath.path);
    return { ...byPath, active: true };
  }

  // Assume it's a custom path
  if (!existsSync(pathOrName)) {
    throw notFound(`Vault at ${pathOrName}`);
  }

  setConfigValue("vault", pathOrName);
  return {
    id: "custom",
    name: basename(pathOrName),
    path: pathOrName,
    active: true,
  };
}
```

**Step 2: Create vault commands**

```typescript
// packages/cli/src/commands/vault.ts

import { Command } from "commander";
import chalk from "chalk";
import { getObsidianVaults, getActiveVault, switchVault } from "../lib/vault.js";
import { PetraError } from "@petra/shared";

export function vaultCommands(parent: Command): void {
  const vault = parent
    .command("vault")
    .description("Manage vaults");

  vault
    .command("list")
    .description("List available vaults")
    .action(() => {
      const vaults = getObsidianVaults();

      if (vaults.length === 0) {
        console.log(chalk.dim("No Obsidian vaults found"));
        console.log(chalk.dim("Use 'petra vault switch <path>' to set a vault manually"));
        return;
      }

      for (const v of vaults) {
        const marker = v.active ? chalk.green("* ") : "  ";
        console.log(`${marker}${chalk.bold(v.name)}`);
        console.log(`   ${chalk.dim(v.path)}`);
      }
    });

  vault
    .command("switch <path>")
    .description("Switch active vault")
    .action((path) => {
      try {
        const v = switchVault(path);
        console.log(chalk.green(`Switched to vault: ${v.name}`));
        console.log(chalk.dim(v.path));
      } catch (err) {
        if (err instanceof PetraError) {
          console.error(chalk.red(err.message));
          process.exit(1);
        }
        throw err;
      }
    });

  vault
    .command("info")
    .description("Show current vault info")
    .action(() => {
      const v = getActiveVault();

      if (!v) {
        console.log(chalk.yellow("No vault configured"));
        console.log(chalk.dim("Use 'petra vault switch <path>' to set a vault"));
        return;
      }

      console.log(chalk.bold("Active Vault"));
      console.log(`  Name: ${v.name}`);
      console.log(`  Path: ${v.path}`);
      console.log(`  ID:   ${v.id}`);
    });
}
```

**Step 3: Update command registry**

```typescript
// packages/cli/src/commands/index.ts

import { Command } from "commander";
import { configCommands } from "./config.js";
import { vaultCommands } from "./vault.js";

export function registerCommands(program: Command): void {
  // Note commands (placeholder for now)
  const note = program
    .command("note")
    .description("Manage notes");

  note
    .command("create <path>")
    .description("Create a new note")
    .option("-t, --template <name>", "Use a template")
    .option("-c, --content <content>", "Initial content")
    .action(async (path, options) => {
      console.log("note create", path, options);
    });

  note
    .command("read <path>")
    .description("Read a note")
    .action(async (path) => {
      console.log("note read", path);
    });

  note
    .command("update <path>")
    .description("Update a note")
    .option("-c, --content <content>", "New content")
    .option("-a, --append <content>", "Append content")
    .action(async (path, options) => {
      console.log("note update", path, options);
    });

  note
    .command("delete <path>")
    .description("Delete a note")
    .option("--trash", "Move to trash instead of permanent delete")
    .action(async (path, options) => {
      console.log("note delete", path, options);
    });

  note
    .command("list")
    .description("List notes")
    .option("-f, --folder <path>", "Filter by folder")
    .option("-l, --limit <n>", "Limit results", parseInt)
    .action(async (options) => {
      console.log("note list", options);
    });

  // Vault commands
  vaultCommands(program);

  // Config commands
  configCommands(program);
}
```

**Step 4: Test vault commands**

Run: `bun run packages/cli/src/index.ts vault list`
Expected: Lists Obsidian vaults (or shows "no vaults found")

Run: `bun run packages/cli/src/index.ts vault info`
Expected: Shows current vault info (or "no vault configured")

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement vault discovery and switch commands"
```

---

## Task 6: Implement note create command (petra-0qc)

**Files:**
- Create: `packages/cli/src/lib/notes.ts`
- Create: `packages/cli/src/commands/note.ts`
- Modify: `packages/cli/src/commands/index.ts`

**Step 1: Create notes library**

```typescript
// packages/cli/src/lib/notes.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";
import matter from "gray-matter";
import type { Note, NoteInfo, NoteFrontmatter } from "@petra/shared";
import { notFound, alreadyExists, invalidPath } from "@petra/shared";
import { TRASH_FOLDER } from "@petra/shared";
import { requireVault } from "./vault.js";

/** Normalize note path - add .md if needed, resolve relative paths */
function normalizePath(notePath: string): string {
  let normalized = notePath;

  // Remove leading slash if present
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }

  // Add .md extension if not present
  if (!normalized.endsWith(".md")) {
    normalized += ".md";
  }

  return normalized;
}

/** Get full file path for a note */
function getFullPath(notePath: string): string {
  const vault = requireVault();
  return join(vault.path, normalizePath(notePath));
}

/** Create a new note */
export function createNote(
  notePath: string,
  content: string = "",
  frontmatter: NoteFrontmatter = {}
): Note {
  const fullPath = getFullPath(notePath);

  if (existsSync(fullPath)) {
    throw alreadyExists(`Note at ${notePath}`);
  }

  // Ensure directory exists
  const dir = dirname(fullPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Set created date if not provided
  const fm: NoteFrontmatter = {
    created: new Date().toISOString(),
    ...frontmatter,
  };

  // Build file content
  const raw = matter.stringify(content, fm);

  writeFileSync(fullPath, raw, "utf-8");

  return {
    path: normalizePath(notePath).replace(/\.md$/, ""),
    title: fm.title || basename(notePath, ".md"),
    content,
    frontmatter: fm,
    raw,
  };
}

/** Read a note */
export function readNote(notePath: string): Note {
  const fullPath = getFullPath(notePath);

  if (!existsSync(fullPath)) {
    throw notFound(`Note at ${notePath}`);
  }

  const raw = readFileSync(fullPath, "utf-8");
  const { content, data } = matter(raw);
  const fm = data as NoteFrontmatter;

  return {
    path: normalizePath(notePath).replace(/\.md$/, ""),
    title: fm.title || basename(notePath, ".md"),
    content,
    frontmatter: fm,
    raw,
  };
}

/** Update a note */
export function updateNote(
  notePath: string,
  options: { content?: string; append?: string; frontmatter?: NoteFrontmatter }
): Note {
  const existing = readNote(notePath);

  let newContent = existing.content;
  if (options.content !== undefined) {
    newContent = options.content;
  } else if (options.append !== undefined) {
    newContent = existing.content + "\n" + options.append;
  }

  const newFrontmatter: NoteFrontmatter = {
    ...existing.frontmatter,
    ...options.frontmatter,
    modified: new Date().toISOString(),
  };

  const raw = matter.stringify(newContent, newFrontmatter);
  const fullPath = getFullPath(notePath);
  writeFileSync(fullPath, raw, "utf-8");

  return {
    path: existing.path,
    title: newFrontmatter.title || existing.title,
    content: newContent,
    frontmatter: newFrontmatter,
    raw,
  };
}

/** Delete a note */
export function deleteNote(notePath: string, useTrash: boolean = false): void {
  const fullPath = getFullPath(notePath);

  if (!existsSync(fullPath)) {
    throw notFound(`Note at ${notePath}`);
  }

  if (useTrash) {
    const vault = requireVault();
    const trashDir = join(vault.path, TRASH_FOLDER);

    if (!existsSync(trashDir)) {
      mkdirSync(trashDir, { recursive: true });
    }

    const trashPath = join(trashDir, basename(fullPath));
    renameSync(fullPath, trashPath);
  } else {
    unlinkSync(fullPath);
  }
}
```

**Step 2: Create note commands (create only for now)**

```typescript
// packages/cli/src/commands/note.ts

import { Command } from "commander";
import chalk from "chalk";
import { createNote, readNote, updateNote, deleteNote } from "../lib/notes.js";
import { PetraError } from "@petra/shared";

function handleError(err: unknown): never {
  if (err instanceof PetraError) {
    console.error(chalk.red(err.message));
    process.exit(1);
  }
  throw err;
}

export function noteCommands(parent: Command): void {
  const note = parent
    .command("note")
    .description("Manage notes");

  note
    .command("create <path>")
    .description("Create a new note")
    .option("-t, --title <title>", "Note title")
    .option("-c, --content <content>", "Initial content")
    .option("--tags <tags>", "Comma-separated tags")
    .action((path, options) => {
      try {
        const frontmatter: Record<string, unknown> = {};
        if (options.title) frontmatter.title = options.title;
        if (options.tags) frontmatter.tags = options.tags.split(",").map((t: string) => t.trim());

        const note = createNote(path, options.content || "", frontmatter);
        console.log(chalk.green(`Created note: ${note.path}`));
      } catch (err) {
        handleError(err);
      }
    });

  note
    .command("read <path>")
    .description("Read a note")
    .action((path) => {
      try {
        const n = readNote(path);
        console.log(chalk.bold(n.title));
        console.log(chalk.dim("---"));
        console.log(n.content);
      } catch (err) {
        handleError(err);
      }
    });

  note
    .command("update <path>")
    .description("Update a note")
    .option("-c, --content <content>", "New content (replaces existing)")
    .option("-a, --append <content>", "Append content")
    .action((path, options) => {
      try {
        const n = updateNote(path, {
          content: options.content,
          append: options.append,
        });
        console.log(chalk.green(`Updated note: ${n.path}`));
      } catch (err) {
        handleError(err);
      }
    });

  note
    .command("delete <path>")
    .description("Delete a note")
    .option("--trash", "Move to trash instead of permanent delete")
    .action((path, options) => {
      try {
        deleteNote(path, options.trash);
        console.log(chalk.green(`Deleted note: ${path}`));
      } catch (err) {
        handleError(err);
      }
    });

  note
    .command("list")
    .description("List notes")
    .option("-f, --folder <path>", "Filter by folder")
    .option("-l, --limit <n>", "Limit results", parseInt)
    .action((options) => {
      console.log("note list", options);
      // Will implement in Task 10
    });
}
```

**Step 3: Update command registry**

```typescript
// packages/cli/src/commands/index.ts

import { Command } from "commander";
import { configCommands } from "./config.js";
import { vaultCommands } from "./vault.js";
import { noteCommands } from "./note.js";

export function registerCommands(program: Command): void {
  noteCommands(program);
  vaultCommands(program);
  configCommands(program);
}
```

**Step 4: Test note create**

First set a vault:
Run: `bun run packages/cli/src/index.ts vault switch /tmp/test-vault`

Then create a note:
Run: `bun run packages/cli/src/index.ts note create "Test Note" --content "Hello world"`
Expected: `Created note: Test Note`

Verify file exists:
Run: `cat "/tmp/test-vault/Test Note.md"`
Expected: Shows frontmatter and content

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement note create/read/update/delete commands"
```

---

## Task 7-10: Remaining note commands

Tasks 7-10 (note read, update, delete, list) are already implemented in Task 6. The remaining work is:

### Task 10: Implement note list command (petra-v7q)

**Modify:** `packages/cli/src/lib/notes.ts` - add listNotes function
**Modify:** `packages/cli/src/commands/note.ts` - complete list action

**Step 1: Add listNotes to notes.ts**

Add this function to `packages/cli/src/lib/notes.ts`:

```typescript
import { readdirSync, statSync } from "node:fs";

/** List notes in vault */
export function listNotes(options: {
  folder?: string;
  limit?: number;
} = {}): NoteInfo[] {
  const vault = requireVault();
  const baseDir = options.folder
    ? join(vault.path, options.folder)
    : vault.path;

  if (!existsSync(baseDir)) {
    return [];
  }

  const notes: NoteInfo[] = [];

  function scanDir(dir: string, relativePath: string = ""): void {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      // Skip hidden files and .obsidian folder
      if (entry.startsWith(".")) continue;

      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDir(fullPath, join(relativePath, entry));
      } else if (entry.endsWith(".md")) {
        const notePath = join(relativePath, entry);
        try {
          const raw = readFileSync(fullPath, "utf-8");
          const { data } = matter(raw);
          const fm = data as NoteFrontmatter;

          notes.push({
            path: notePath.replace(/\.md$/, ""),
            title: fm.title || basename(entry, ".md"),
            tags: fm.tags || [],
            created: fm.created,
            modified: fm.modified,
          });
        } catch {
          // Skip files that can't be parsed
        }
      }

      // Check limit
      if (options.limit && notes.length >= options.limit) {
        return;
      }
    }
  }

  scanDir(baseDir);

  // Sort by modified date (most recent first)
  notes.sort((a, b) => {
    const aDate = a.modified || a.created || "";
    const bDate = b.modified || b.created || "";
    return bDate.localeCompare(aDate);
  });

  if (options.limit) {
    return notes.slice(0, options.limit);
  }

  return notes;
}
```

**Step 2: Update note list command**

In `packages/cli/src/commands/note.ts`, update the list action:

```typescript
note
  .command("list")
  .description("List notes")
  .option("-f, --folder <path>", "Filter by folder")
  .option("-l, --limit <n>", "Limit results", parseInt)
  .action((options) => {
    try {
      const notes = listNotes({
        folder: options.folder,
        limit: options.limit,
      });

      if (notes.length === 0) {
        console.log(chalk.dim("No notes found"));
        return;
      }

      for (const n of notes) {
        console.log(chalk.bold(n.title));
        console.log(chalk.dim(`  ${n.path}`));
        if (n.tags.length > 0) {
          console.log(chalk.cyan(`  #${n.tags.join(" #")}`));
        }
      }
    } catch (err) {
      handleError(err);
    }
  });
```

Don't forget to add the import: `import { createNote, readNote, updateNote, deleteNote, listNotes } from "../lib/notes.js";`

**Step 3: Test note list**

Run: `bun run packages/cli/src/index.ts note list`
Expected: Lists notes in vault

Run: `bun run packages/cli/src/index.ts note list --limit 5`
Expected: Lists up to 5 notes

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: implement note list command"
```

---

## Task 11: Implement output formatting (petra-98p)

**Files:**
- Create: `packages/cli/src/lib/output.ts`
- Modify: `packages/cli/src/index.ts`
- Modify: `packages/cli/src/commands/note.ts`

**Step 1: Create output library**

```typescript
// packages/cli/src/lib/output.ts

import chalk from "chalk";
import type { OutputFormat, GlobalOptions } from "@petra/shared";
import { getConfigValue } from "./config.js";

let globalOptions: GlobalOptions = {};

export function setGlobalOptions(opts: GlobalOptions): void {
  globalOptions = opts;
}

export function getOutputFormat(): OutputFormat {
  // Priority: CLI flag > env var > config
  if (globalOptions.quiet) return "quiet";
  if (globalOptions.json) return "json";

  const envFormat = process.env.PETRA_OUTPUT;
  if (envFormat === "json" || envFormat === "quiet" || envFormat === "pretty") {
    return envFormat;
  }

  const configFormat = getConfigValue("output") as OutputFormat | undefined;
  if (configFormat) return configFormat;

  return "pretty";
}

/** Output data in the appropriate format */
export function output<T>(data: T, prettyFn?: (data: T) => void): void {
  const format = getOutputFormat();

  if (format === "quiet") {
    return;
  }

  if (format === "json") {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (prettyFn) {
    prettyFn(data);
  } else {
    console.log(data);
  }
}

/** Output success message */
export function success(message: string): void {
  const format = getOutputFormat();

  if (format === "quiet") return;
  if (format === "json") {
    console.log(JSON.stringify({ ok: true, message }));
    return;
  }

  console.log(chalk.green(message));
}

/** Output error message */
export function error(message: string, code?: string): void {
  const format = getOutputFormat();

  if (format === "json") {
    console.error(JSON.stringify({ ok: false, error: { code, message } }));
    return;
  }

  console.error(chalk.red(message));
}
```

**Step 2: Update CLI entry point**

```typescript
// packages/cli/src/index.ts
#!/usr/bin/env node

import { Command } from "commander";
import { VERSION } from "@petra/shared";
import { registerCommands } from "./commands/index.js";
import { setGlobalOptions } from "./lib/output.js";

const program = new Command();

program
  .name("petra")
  .description("CLI for Obsidian vaults")
  .version(VERSION)
  .option("-j, --json", "Output as JSON")
  .option("-q, --quiet", "Suppress non-error output")
  .option("-v, --vault <path>", "Override vault path")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    setGlobalOptions({
      json: opts.json,
      quiet: opts.quiet,
      vault: opts.vault,
    });
  });

registerCommands(program);

program.parse();
```

**Step 3: Update note commands to use output helpers**

```typescript
// packages/cli/src/commands/note.ts

import { Command } from "commander";
import chalk from "chalk";
import { createNote, readNote, updateNote, deleteNote, listNotes } from "../lib/notes.js";
import { output, success, error } from "../lib/output.js";
import { PetraError } from "@petra/shared";
import type { Note, NoteInfo } from "@petra/shared";

function handleError(err: unknown): never {
  if (err instanceof PetraError) {
    error(err.message, err.code);
    process.exit(1);
  }
  throw err;
}

export function noteCommands(parent: Command): void {
  const note = parent
    .command("note")
    .description("Manage notes");

  note
    .command("create <path>")
    .description("Create a new note")
    .option("-t, --title <title>", "Note title")
    .option("-c, --content <content>", "Initial content")
    .option("--tags <tags>", "Comma-separated tags")
    .action((path, options) => {
      try {
        const frontmatter: Record<string, unknown> = {};
        if (options.title) frontmatter.title = options.title;
        if (options.tags) frontmatter.tags = options.tags.split(",").map((t: string) => t.trim());

        const n = createNote(path, options.content || "", frontmatter);
        output<Note>(n, () => success(`Created note: ${n.path}`));
      } catch (err) {
        handleError(err);
      }
    });

  note
    .command("read <path>")
    .description("Read a note")
    .action((path) => {
      try {
        const n = readNote(path);
        output<Note>(n, () => {
          console.log(chalk.bold(n.title));
          console.log(chalk.dim("---"));
          console.log(n.content);
        });
      } catch (err) {
        handleError(err);
      }
    });

  note
    .command("update <path>")
    .description("Update a note")
    .option("-c, --content <content>", "New content (replaces existing)")
    .option("-a, --append <content>", "Append content")
    .action((path, options) => {
      try {
        const n = updateNote(path, {
          content: options.content,
          append: options.append,
        });
        output<Note>(n, () => success(`Updated note: ${n.path}`));
      } catch (err) {
        handleError(err);
      }
    });

  note
    .command("delete <path>")
    .description("Delete a note")
    .option("--trash", "Move to trash instead of permanent delete")
    .action((path, options) => {
      try {
        deleteNote(path, options.trash);
        output({ deleted: path }, () => success(`Deleted note: ${path}`));
      } catch (err) {
        handleError(err);
      }
    });

  note
    .command("list")
    .description("List notes")
    .option("-f, --folder <path>", "Filter by folder")
    .option("-l, --limit <n>", "Limit results", parseInt)
    .action((options) => {
      try {
        const notes = listNotes({
          folder: options.folder,
          limit: options.limit,
        });

        output<NoteInfo[]>(notes, () => {
          if (notes.length === 0) {
            console.log(chalk.dim("No notes found"));
            return;
          }

          for (const n of notes) {
            console.log(chalk.bold(n.title));
            console.log(chalk.dim(`  ${n.path}`));
            if (n.tags.length > 0) {
              console.log(chalk.cyan(`  #${n.tags.join(" #")}`));
            }
          }
        });
      } catch (err) {
        handleError(err);
      }
    });
}
```

**Step 4: Test output formats**

Run: `bun run packages/cli/src/index.ts note list`
Expected: Pretty formatted output

Run: `bun run packages/cli/src/index.ts note list --json`
Expected: JSON array output

Run: `bun run packages/cli/src/index.ts note list --quiet`
Expected: No output

Run: `PETRA_OUTPUT=json bun run packages/cli/src/index.ts note list`
Expected: JSON array output

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: implement output formatting (pretty, JSON, quiet)"
```

---

## Final: Verify Phase 1 Complete

**Checklist:**
- [ ] `bun install` works
- [ ] `petra --help` shows all commands
- [ ] `petra config set/get/list` works
- [ ] `petra vault list/switch/info` works
- [ ] `petra note create/read/update/delete/list` works
- [ ] `--json` flag produces JSON output
- [ ] `--quiet` flag suppresses output
- [ ] `PETRA_OUTPUT=json` environment variable works

**Final commit:**

```bash
git add -A
git commit -m "feat: complete Phase 1 - MVP with file-mode CRUD"
```
