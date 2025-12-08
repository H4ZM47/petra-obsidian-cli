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
