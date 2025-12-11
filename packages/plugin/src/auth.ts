// packages/plugin/src/auth.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";
import { homedir } from "os";
import { join } from "path";
import { CONFIG_DIR, TOKEN_FILE } from "@petra/shared";

/** Generate a cryptographically secure random token */
function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Get or create auth token, storing at ~/.petra/token */
export function getOrCreateToken(): string {
  const configDir = join(homedir(), CONFIG_DIR);
  const tokenPath = join(configDir, TOKEN_FILE);

  // Check if token exists
  if (existsSync(tokenPath)) {
    try {
      const token = readFileSync(tokenPath, "utf-8").trim();
      if (token.length > 0) {
        return token;
      }
    } catch {
      // Fall through to create new token
    }
  }

  // Create config directory if needed
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  // Generate and save new token
  const token = generateToken();
  writeFileSync(tokenPath, token, { mode: 0o600 }); // User-only permissions

  return token;
}
