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
