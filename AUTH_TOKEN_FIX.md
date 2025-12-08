# Auth Token Issue - Resolution

## Problem Summary

Bridge commands were failing with `401 AUTH_REQUIRED` errors because the token file at `~/.petra/token` contained a test value (`test-token-abc123`) instead of a properly generated secure token.

## Root Cause

The test suite in `packages/plugin/src/auth.test.ts` was creating test tokens in the real configuration directory (`~/.petra/`) without proper cleanup. When tests were interrupted or failed, the test token persisted, preventing the plugin from generating a proper token.

## Resolution

### 1. Immediate Fix (For Users)

If you're experiencing auth issues:

```bash
# Remove the invalid token
rm ~/.petra/token

# Restart Obsidian
# The Petra plugin will automatically generate a new secure token
```

### 2. Code Fix (Implemented)

Added `try-finally` blocks to all auth tests to ensure token cleanup even if tests fail:

```typescript
test("reads existing token from disk", async () => {
  try {
    // Test code here...
  } finally {
    // CRITICAL: Always clean up test token, even if test fails
    if (existsSync(tokenPath)) {
      rmSync(tokenPath);
    }
  }
});
```

This prevents test tokens from persisting in the real config directory.

## Verification

After fix:
1. ✅ All 7 auth tests pass
2. ✅ Token file properly cleaned up after tests
3. ✅ No test tokens left in `~/.petra/`

## Future Improvements

Consider these enhancements (tracked in beads):

1. **petra-unr**: Add token management UI to Obsidian plugin settings
   - Display/regenerate token
   - Copy to clipboard
   - Validate token format

2. **petra-2zh**: Add `petra bridge token` CLI command
   - `petra bridge status` - Check bridge and auth
   - `petra bridge token show` - Display token
   - `petra bridge token regenerate` - Force regenerate
   - `petra bridge token validate` - Check format

## Testing Bridge Features

Once token is regenerated, run the test suite:

```bash
./scripts/test-bridge.sh
```

Or manually test individual features:

```bash
petra note backlinks "note-path"
petra note outlinks "note-path"
petra graph neighbors "note-path"
petra graph query --json
petra template list
```

## For Developers

When writing tests that interact with real config files:

1. Always use `try-finally` blocks
2. Clean up in `finally` block, not at end of test
3. Consider using temporary directories for tests
4. Use `beforeAll`/`afterAll` hooks to backup/restore real config

Example pattern:

```typescript
let originalToken: string | null = null;

beforeAll(() => {
  if (existsSync(tokenPath)) {
    originalToken = readFileSync(tokenPath, "utf-8");
  }
});

afterAll(() => {
  if (originalToken !== null) {
    writeFileSync(tokenPath, originalToken, { mode: 0o600 });
  }
});

test("some test", async () => {
  try {
    // Test code
  } finally {
    // Cleanup
  }
});
```
