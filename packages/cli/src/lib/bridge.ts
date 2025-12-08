// packages/cli/src/lib/bridge.ts

import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { DEFAULT_PORT, CONFIG_DIR, TOKEN_FILE, PetraError } from "@petra/shared";
import type { ApiResult } from "@petra/shared";

const BRIDGE_URL = `http://localhost:${DEFAULT_PORT}`;
const HEALTH_TIMEOUT = 1000; // 1 second timeout for health check

/** Read auth token from ~/.petra/token */
export function getAuthToken(): string | null {
  const tokenPath = join(homedir(), CONFIG_DIR, TOKEN_FILE);
  if (!existsSync(tokenPath)) {
    return null;
  }
  try {
    return readFileSync(tokenPath, "utf-8").trim();
  } catch {
    return null;
  }
}

/** Check if bridge is available by pinging /health */
export async function checkBridgeAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT);

    const response = await fetch(`${BRIDGE_URL}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/** Bridge client for making authenticated requests */
export interface BridgeClient {
  get<T>(path: string): Promise<ApiResult<T>>;
  post<T>(path: string, body?: unknown): Promise<ApiResult<T>>;
  put<T>(path: string, body?: unknown): Promise<ApiResult<T>>;
  delete<T>(path: string): Promise<ApiResult<T>>;
}

/** Create a bridge client with auth token */
export function createBridgeClient(): BridgeClient {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  async function request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResult<T>> {
    const url = `${BRIDGE_URL}${path}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      // Network error (connection refused, DNS failure, etc.)
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new PetraError('BRIDGE_UNAVAILABLE', `Cannot connect to Obsidian bridge: ${message}`);
    }

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'Unknown error');
      throw new PetraError('BRIDGE_ERROR', `Bridge returned ${response.status}: ${errorBody}`);
    }

    return response.json() as Promise<ApiResult<T>>;
  }

  return {
    get: <T>(path: string) => request<T>("GET", path),
    post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
    put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
    delete: <T>(path: string) => request<T>("DELETE", path),
  };
}

/** Get bridge client if available, null otherwise */
export async function getBridgeClient(): Promise<BridgeClient | null> {
  const available = await checkBridgeAvailable();
  if (!available) {
    return null;
  }
  return createBridgeClient();
}

/** Require bridge to be available, throw if not */
export async function requireBridge(): Promise<BridgeClient> {
  const client = await getBridgeClient();
  if (!client) {
    throw new Error(
      "This operation requires Obsidian to be running with petra-bridge.\n" +
      "Start Obsidian or use a file-mode alternative."
    );
  }
  return client;
}
