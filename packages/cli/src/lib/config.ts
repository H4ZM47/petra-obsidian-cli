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
