// packages/cli/src/lib/notes.test.ts
// Security tests for path traversal protection

import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { join, resolve } from "node:path";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";

// Test vault setup
const TEST_VAULT = "/tmp/petra-test-vault";

// Mock the vault module to return our test vault
mock.module("./vault.js", () => ({
  requireVault: () => ({ path: TEST_VAULT, name: "test-vault" }),
  getActiveVault: () => ({ path: TEST_VAULT, name: "test-vault" }),
}));

// Import after mocking
import { createNote, readNote, deleteNote, listNotes, moveNote } from "./notes.js";
import { PetraError } from "@petra/shared";

describe("Path Traversal Protection", () => {
  beforeAll(() => {
    // Create test vault
    if (existsSync(TEST_VAULT)) {
      rmSync(TEST_VAULT, { recursive: true });
    }
    mkdirSync(TEST_VAULT, { recursive: true });

    // Create a test note
    writeFileSync(join(TEST_VAULT, "test.md"), "---\ntitle: Test\n---\nTest content");
  });

  afterAll(() => {
    // Cleanup
    if (existsSync(TEST_VAULT)) {
      rmSync(TEST_VAULT, { recursive: true });
    }
  });

  describe("readNote path traversal", () => {
    test("rejects simple ../ traversal", () => {
      expect(() => readNote("../etc/passwd")).toThrow(PetraError);
    });

    test("rejects ../../ traversal", () => {
      expect(() => readNote("../../etc/passwd")).toThrow(PetraError);
    });

    test("rejects nested traversal in path", () => {
      expect(() => readNote("folder/../../../etc/passwd")).toThrow(PetraError);
    });

    test("rejects absolute path outside vault", () => {
      expect(() => readNote("/etc/passwd")).toThrow(PetraError);
    });

    test("rejects encoded traversal sequences", () => {
      // URL-encoded ../
      expect(() => readNote("%2e%2e/etc/passwd")).toThrow();
    });

    test("allows valid paths within vault", () => {
      // This should NOT throw INVALID_PATH (may throw NOT_FOUND if file doesn't exist)
      try {
        readNote("test");
        // If we get here, path was valid
      } catch (e) {
        if (e instanceof PetraError) {
          expect(e.code).not.toBe("INVALID_PATH");
        }
      }
    });

    test("allows nested folder paths within vault", () => {
      try {
        readNote("subfolder/nested/note");
      } catch (e) {
        if (e instanceof PetraError) {
          // NOT_FOUND is ok, INVALID_PATH is not
          expect(e.code).not.toBe("INVALID_PATH");
        }
      }
    });
  });

  describe("createNote path traversal", () => {
    test("rejects ../ in create path", () => {
      expect(() => createNote("../malicious", "content")).toThrow(PetraError);
    });

    test("rejects traversal to system directories", () => {
      expect(() => createNote("../../../tmp/evil", "content")).toThrow(PetraError);
    });
  });

  describe("deleteNote path traversal", () => {
    test("rejects ../ in delete path", () => {
      expect(() => deleteNote("../important")).toThrow(PetraError);
    });
  });

  describe("moveNote path traversal", () => {
    test("rejects traversal in source path", () => {
      expect(() => moveNote("../secret", "newname")).toThrow(PetraError);
    });

    test("rejects traversal in destination path", () => {
      expect(() => moveNote("test", "../../../tmp/stolen")).toThrow(PetraError);
    });
  });

  describe("listNotes path traversal", () => {
    test("rejects traversal in folder filter", () => {
      // Should throw on path traversal attempt (strict security)
      expect(() => listNotes({ folder: "../../../etc" })).toThrow(PetraError);
    });
  });
});

describe("Edge Cases", () => {
  beforeAll(() => {
    if (!existsSync(TEST_VAULT)) {
      mkdirSync(TEST_VAULT, { recursive: true });
    }
  });

  test("handles Windows-style path separators", () => {
    expect(() => readNote("..\\..\\etc\\passwd")).toThrow();
  });

  test("handles mixed separators", () => {
    expect(() => readNote("..\\../etc/passwd")).toThrow();
  });

  test("handles double slashes", () => {
    try {
      readNote("folder//nested//note");
    } catch (e) {
      if (e instanceof PetraError) {
        // Should NOT be INVALID_PATH
        expect(e.code).not.toBe("INVALID_PATH");
      }
    }
  });

  test("rejects paths with double dots (conservative security)", () => {
    // Paths containing '..' are rejected even if not traversal attempts
    // This is conservative but prevents edge-case attacks
    expect(() => readNote("test...")).toThrow(PetraError);
    expect(() => readNote("my..note")).toThrow(PetraError);
  });
});
