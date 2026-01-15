// packages/cli/src/lib/cache.ts

import { VaultCache } from "@petra/cache";
import { requireVault } from "./vault.js";

let cacheInstance: VaultCache | null = null;

/** Get or create the vault cache instance */
export function getCache(): VaultCache {
  if (!cacheInstance) {
    const vault = requireVault();
    cacheInstance = new VaultCache(vault.path);
  }
  return cacheInstance;
}

/** Sync the cache and return stats */
export function syncCache(): { added: number; modified: number; deleted: number; totalTime: number } {
  const cache = getCache();
  return cache.sync();
}

/** Clear the cache instance (for testing) */
export function clearCacheInstance(): void {
  if (cacheInstance) {
    cacheInstance.close();
    cacheInstance = null;
  }
}
