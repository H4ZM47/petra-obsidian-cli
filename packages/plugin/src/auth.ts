// packages/plugin/src/auth.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { CONFIG_DIR, TOKEN_FILE } from "@petra/shared";

const TOKEN_LENGTH = 32;

/** Generate a random token */
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
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
