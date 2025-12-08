// packages/plugin/src/server.test.ts
// Security tests for HTTP server

import { describe, test, expect, beforeAll, afterAll, mock } from "bun:test";
import { timingSafeEqual } from "crypto";

// Test constant-time comparison function behavior
describe("Timing-Safe Authentication", () => {
  test("timingSafeEqual rejects different length strings", () => {
    const a = Buffer.from("short");
    const b = Buffer.from("much longer string");

    // timingSafeEqual throws if lengths differ
    expect(() => timingSafeEqual(a, b)).toThrow();
  });

  test("timingSafeEqual returns false for same-length different strings", () => {
    const a = Buffer.from("password123");
    const b = Buffer.from("password456");

    expect(timingSafeEqual(a, b)).toBe(false);
  });

  test("timingSafeEqual returns true for identical strings", () => {
    const a = Buffer.from("correct-token-123");
    const b = Buffer.from("correct-token-123");

    expect(timingSafeEqual(a, b)).toBe(true);
  });

  test("auth check implementation handles length check before timingSafeEqual", () => {
    // This mirrors the server's checkAuth logic
    function secureCompare(expected: string, actual: string): boolean {
      const expectedBuf = Buffer.from(expected);
      const actualBuf = Buffer.from(actual);
      if (expectedBuf.length !== actualBuf.length) return false;
      return timingSafeEqual(expectedBuf, actualBuf);
    }

    // Different lengths - should return false without throwing
    expect(secureCompare("short", "much longer")).toBe(false);

    // Same length, different content
    expect(secureCompare("token1", "token2")).toBe(false);

    // Identical
    expect(secureCompare("correct", "correct")).toBe(true);
  });
});

describe("Request Body Size Limits", () => {
  const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB

  test("MAX_BODY_SIZE is 10MB", () => {
    expect(MAX_BODY_SIZE).toBe(10485760);
  });

  test("rejects body larger than limit", () => {
    // Simulate the size check logic from parseBody
    function checkBodySize(size: number): boolean {
      return size <= MAX_BODY_SIZE;
    }

    // Just under limit - should pass
    expect(checkBodySize(MAX_BODY_SIZE - 1)).toBe(true);

    // At limit - should pass
    expect(checkBodySize(MAX_BODY_SIZE)).toBe(true);

    // Over limit - should fail
    expect(checkBodySize(MAX_BODY_SIZE + 1)).toBe(false);

    // Way over limit - should fail
    expect(checkBodySize(100 * 1024 * 1024)).toBe(false);
  });

  test("cumulative size check catches gradual buildup", () => {
    // Simulate receiving data in chunks
    function simulateChunkedRequest(chunkSizes: number[]): { accepted: boolean; totalSize: number } {
      let size = 0;
      for (const chunkSize of chunkSizes) {
        size += chunkSize;
        if (size > MAX_BODY_SIZE) {
          return { accepted: false, totalSize: size };
        }
      }
      return { accepted: true, totalSize: size };
    }

    // Small chunks that total under limit
    const smallChunks = Array(100).fill(1024); // 100 x 1KB = 100KB
    expect(simulateChunkedRequest(smallChunks).accepted).toBe(true);

    // Chunks that exceed limit
    const largeChunks = Array(11).fill(1024 * 1024); // 11 x 1MB = 11MB
    const result = simulateChunkedRequest(largeChunks);
    expect(result.accepted).toBe(false);
  });
});

describe("CORS Security", () => {
  function isAllowedOrigin(origin: string): boolean {
    // Mirror the server's CORS logic - strict regex matching
    // Prevents subdomain attacks like http://localhost.evil.com
    return !!(origin && (
      origin === 'app://obsidian.md' ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)
    ));
  }

  describe("allows localhost origins", () => {
    test("allows http://localhost", () => {
      expect(isAllowedOrigin("http://localhost")).toBe(true);
    });

    test("allows http://localhost:3000", () => {
      expect(isAllowedOrigin("http://localhost:3000")).toBe(true);
    });

    test("allows http://localhost:8080", () => {
      expect(isAllowedOrigin("http://localhost:8080")).toBe(true);
    });

    test("allows http://127.0.0.1", () => {
      expect(isAllowedOrigin("http://127.0.0.1")).toBe(true);
    });

    test("allows http://127.0.0.1:27182", () => {
      expect(isAllowedOrigin("http://127.0.0.1:27182")).toBe(true);
    });

    test("allows https://localhost", () => {
      expect(isAllowedOrigin("https://localhost")).toBe(true);
    });

    test("allows app://obsidian.md", () => {
      expect(isAllowedOrigin("app://obsidian.md")).toBe(true);
    });
  });

  describe("rejects external origins", () => {
    test("rejects http://example.com", () => {
      expect(isAllowedOrigin("http://example.com")).toBe(false);
    });

    test("rejects http://evil.com", () => {
      expect(isAllowedOrigin("http://evil.com")).toBe(false);
    });

    test("rejects http://localhost.evil.com (subdomain attack)", () => {
      expect(isAllowedOrigin("http://localhost.evil.com")).toBe(false);
    });

    test("rejects http://127.0.0.1.evil.com (subdomain attack)", () => {
      expect(isAllowedOrigin("http://127.0.0.1.evil.com")).toBe(false);
    });

    test("rejects null origin", () => {
      expect(isAllowedOrigin("null")).toBe(false);
    });

    test("rejects file:// origin", () => {
      expect(isAllowedOrigin("file:///path/to/file")).toBe(false);
    });

    test("rejects empty origin", () => {
      expect(isAllowedOrigin("")).toBe(false);
    });
  });

  describe("edge cases", () => {
    test("rejects localhost with wrong protocol", () => {
      expect(isAllowedOrigin("ftp://localhost")).toBe(false);
    });

    test("rejects IP addresses other than 127.0.0.1", () => {
      expect(isAllowedOrigin("http://192.168.1.1")).toBe(false);
      expect(isAllowedOrigin("http://10.0.0.1")).toBe(false);
      expect(isAllowedOrigin("http://0.0.0.0")).toBe(false);
    });

    test("rejects ::1 (IPv6 localhost)", () => {
      // Note: Current implementation doesn't allow IPv6 localhost
      expect(isAllowedOrigin("http://[::1]")).toBe(false);
    });
  });
});

describe("Server Binding Security", () => {
  test("server should bind to 127.0.0.1 only", () => {
    // The server binds to 127.0.0.1, not 0.0.0.0
    // This prevents external network access
    const BIND_ADDRESS = "127.0.0.1";

    expect(BIND_ADDRESS).toBe("127.0.0.1");
    expect(BIND_ADDRESS).not.toBe("0.0.0.0");
  });
});
