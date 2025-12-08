// packages/plugin/src/auth.test.ts
// Security tests for token generation

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { existsSync, mkdirSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

// Save original token if it exists
const CONFIG_DIR = ".petra";
const TOKEN_FILE = "token";
const configDir = join(homedir(), CONFIG_DIR);
const tokenPath = join(configDir, TOKEN_FILE);
let originalToken: string | null = null;

describe("Token Generation Security", () => {
  beforeAll(() => {
    // Backup existing token
    if (existsSync(tokenPath)) {
      originalToken = readFileSync(tokenPath, "utf-8");
    }
  });

  afterAll(() => {
    // Restore original token if it existed
    if (originalToken !== null) {
      const { writeFileSync } = require("fs");
      writeFileSync(tokenPath, originalToken, { mode: 0o600 });
    }
  });

  test("generates tokens with sufficient entropy (32 bytes = 256 bits)", async () => {
    try {
      // Delete existing token to force regeneration
      if (existsSync(tokenPath)) {
        rmSync(tokenPath);
      }

      // Import fresh to generate new token
      const { getOrCreateToken } = await import("./auth.js");
      const token = getOrCreateToken();

      // base64url of 32 bytes = 43 characters (with no padding)
      // 32 bytes * 4/3 = 42.67, rounds to 43 characters
      expect(token.length).toBeGreaterThanOrEqual(42);
    } finally {
      // Clean up test-generated token
      if (existsSync(tokenPath)) {
        rmSync(tokenPath);
      }
    }
  });

  test("generates unique tokens (not predictable)", async () => {
    const tokens = new Set<string>();

    try {
      // Generate multiple tokens by deleting and recreating
      for (let i = 0; i < 5; i++) {
        if (existsSync(tokenPath)) {
          rmSync(tokenPath);
        }

        // Need to reset module cache
        delete require.cache[require.resolve("./auth.js")];
        const { getOrCreateToken } = await import("./auth.js");
        tokens.add(getOrCreateToken());
      }

      // All tokens should be unique
      expect(tokens.size).toBe(5);
    } finally {
      // Clean up test-generated token
      if (existsSync(tokenPath)) {
        rmSync(tokenPath);
      }
    }
  });

  test("token uses base64url alphabet (URL-safe)", async () => {
    try {
      if (existsSync(tokenPath)) {
        rmSync(tokenPath);
      }

      delete require.cache[require.resolve("./auth.js")];
      const { getOrCreateToken } = await import("./auth.js");
      const token = getOrCreateToken();

      // base64url uses: A-Z, a-z, 0-9, -, _ (no + or /)
      const base64urlRegex = /^[A-Za-z0-9_-]+$/;
      expect(token).toMatch(base64urlRegex);
    } finally {
      // Clean up test-generated token
      if (existsSync(tokenPath)) {
        rmSync(tokenPath);
      }
    }
  });

  test("token file has restrictive permissions (600)", async () => {
    try {
      if (existsSync(tokenPath)) {
        rmSync(tokenPath);
      }

      delete require.cache[require.resolve("./auth.js")];
      const { getOrCreateToken } = await import("./auth.js");
      getOrCreateToken();

      const { statSync } = require("fs");
      const stats = statSync(tokenPath);
      const mode = stats.mode & 0o777; // Get permission bits

      // Should be 0o600 (owner read/write only)
      expect(mode).toBe(0o600);
    } finally {
      // Clean up test-generated token
      if (existsSync(tokenPath)) {
        rmSync(tokenPath);
      }
    }
  });

  test("tokens have good distribution (statistical randomness)", async () => {
    try {
      // Generate many tokens and check character distribution
      const charCounts: Record<string, number> = {};
      const totalChars = 50 * 43; // 50 tokens * ~43 chars each

      for (let i = 0; i < 50; i++) {
        if (existsSync(tokenPath)) {
          rmSync(tokenPath);
        }

        delete require.cache[require.resolve("./auth.js")];
        const { getOrCreateToken } = await import("./auth.js");
        const token = getOrCreateToken();

        for (const char of token) {
          charCounts[char] = (charCounts[char] || 0) + 1;
        }
      }

      // base64url has 64 possible characters
      // With good randomness, each should appear roughly totalChars/64 times
      const expectedPerChar = totalChars / 64;
      const uniqueChars = Object.keys(charCounts).length;

      // Should use most of the base64url alphabet
      expect(uniqueChars).toBeGreaterThan(50); // At least 50 unique chars out of 64

      // No single character should dominate (< 5x expected frequency)
      for (const [char, count] of Object.entries(charCounts)) {
        expect(count).toBeLessThan(expectedPerChar * 5);
      }
    } finally {
      // Clean up test-generated token
      if (existsSync(tokenPath)) {
        rmSync(tokenPath);
      }
    }
  });
});

describe("Token Persistence", () => {
  test("returns same token on subsequent calls", async () => {
    if (existsSync(tokenPath)) {
      rmSync(tokenPath);
    }

    try {
      delete require.cache[require.resolve("./auth.js")];
      const { getOrCreateToken } = await import("./auth.js");

      const token1 = getOrCreateToken();
      const token2 = getOrCreateToken();

      expect(token1).toBe(token2);
    } finally {
      // Always clean up test-generated token
      if (existsSync(tokenPath)) {
        rmSync(tokenPath);
      }
    }
  });

  test("reads existing token from disk", async () => {
    const { writeFileSync } = require("fs");
    const testToken = "test-token-abc123";

    try {
      // Clean up any existing token first
      if (existsSync(tokenPath)) {
        rmSync(tokenPath);
      }

      if (!existsSync(configDir)) {
        mkdirSync(configDir, { recursive: true });
      }
      writeFileSync(tokenPath, testToken, { mode: 0o600 });

      delete require.cache[require.resolve("./auth.js")];
      const { getOrCreateToken } = await import("./auth.js");

      expect(getOrCreateToken()).toBe(testToken);
    } finally {
      // CRITICAL: Always clean up test token, even if test fails
      // This prevents the test token from persisting if the test suite is interrupted
      if (existsSync(tokenPath)) {
        rmSync(tokenPath);
      }
    }
  });
});
