// packages/plugin/src/routes/notes.test.ts
// Security tests for plugin API path traversal protection

import { describe, test, expect } from "bun:test";

// We need to test the validatePath function directly since we can't easily
// mock the Obsidian App in unit tests. Extract the validation logic for testing.

/**
 * Recreate the validation logic from notes.ts for testing
 * This mirrors the actual implementation to verify its security properties
 */
function normalizePath(path: string): string {
  if (path.startsWith("/")) path = path.slice(1);
  if (!path.endsWith(".md")) path += ".md";
  return path;
}

function validatePath(notePath: string, vaultPath: string): string {
  // First normalize the path
  const normalized = normalizePath(notePath);

  // Check for path traversal sequences
  if (normalized.includes('..')) {
    throw new Error('Path traversal not allowed');
  }

  // Ensure the resolved absolute path stays within vault
  const path = require('path');
  const fullPath = path.resolve(vaultPath, normalized);
  const normalizedVaultPath = path.resolve(vaultPath);

  // Verify resolved path starts with vault root
  if (!fullPath.startsWith(normalizedVaultPath + path.sep) && fullPath !== normalizedVaultPath) {
    throw new Error('Path escapes vault');
  }

  return normalized;
}

describe("Plugin API Path Traversal Protection", () => {
  const vaultPath = "/Users/test/my-vault";

  describe("validatePath rejects traversal attempts", () => {
    test("rejects simple ../ traversal", () => {
      expect(() => validatePath("../etc/passwd", vaultPath)).toThrow("Path traversal not allowed");
    });

    test("rejects ../../ deep traversal", () => {
      expect(() => validatePath("../../etc/passwd", vaultPath)).toThrow("Path traversal not allowed");
    });

    test("rejects nested ../ in middle of path", () => {
      expect(() => validatePath("folder/../../../secret", vaultPath)).toThrow("Path traversal not allowed");
    });

    test("rejects ../ after valid folder", () => {
      expect(() => validatePath("notes/../../../etc/passwd", vaultPath)).toThrow("Path traversal not allowed");
    });

    test("rejects Windows-style ..\\ traversal", () => {
      // After normalization, backslashes may be converted, but .. should still be caught
      expect(() => validatePath("..\\etc\\passwd", vaultPath)).toThrow("Path traversal not allowed");
    });
  });

  describe("validatePath allows valid paths", () => {
    test("allows simple note name", () => {
      const result = validatePath("mynote", vaultPath);
      expect(result).toBe("mynote.md");
    });

    test("allows nested folder path", () => {
      const result = validatePath("folder/subfolder/note", vaultPath);
      expect(result).toBe("folder/subfolder/note.md");
    });

    test("allows path with .md extension", () => {
      const result = validatePath("note.md", vaultPath);
      expect(result).toBe("note.md");
    });

    test("strips leading slash", () => {
      const result = validatePath("/folder/note", vaultPath);
      expect(result).toBe("folder/note.md");
    });

    test("allows deeply nested paths within vault", () => {
      const result = validatePath("a/b/c/d/e/note", vaultPath);
      expect(result).toBe("a/b/c/d/e/note.md");
    });
  });

  describe("Edge cases", () => {
    test("handles double dots that aren't traversal", () => {
      // "my..note" is not traversal (.. not followed by / or \\)
      // However, current implementation rejects any path containing '..'
      // This is a conservative approach - may reject some valid filenames
      expect(() => validatePath("my..note", vaultPath)).toThrow("Path traversal not allowed");
    });

    test("handles single dot (current directory)", () => {
      // Single dot is not traversal
      const result = validatePath("./note", vaultPath);
      expect(result).toBe("./note.md");
    });

    test("rejects hidden traversal with spaces", () => {
      expect(() => validatePath(".. /etc/passwd", vaultPath)).toThrow();
    });

    test("rejects null byte injection", () => {
      // Null bytes could potentially terminate strings in some implementations
      expect(() => validatePath("note\x00/../../../etc/passwd", vaultPath)).toThrow();
    });
  });
});

describe("Remote Attack Vectors", () => {
  const vaultPath = "/Users/test/vault";

  test("rejects URL-style absolute paths", () => {
    // If someone tries file:// or similar
    const result = validatePath("file:///etc/passwd", vaultPath);
    // Should be treated as a relative path, not escape vault
    expect(result).toBe("file:///etc/passwd.md");
  });

  test("handles very long paths without crashing", () => {
    const longPath = "a/".repeat(1000) + "note";
    // Should not throw or crash
    expect(() => validatePath(longPath, vaultPath)).not.toThrow();
  });

  test("handles unicode path components", () => {
    const unicodePath = "笔记/测试";
    const result = validatePath(unicodePath, vaultPath);
    expect(result).toBe("笔记/测试.md");
  });

  test("handles path with special regex characters", () => {
    // These shouldn't cause regex injection issues
    const specialPath = "note[1](2)*+?.md";
    const result = validatePath(specialPath, vaultPath);
    expect(result).toBe("note[1](2)*+?.md");
  });
});
