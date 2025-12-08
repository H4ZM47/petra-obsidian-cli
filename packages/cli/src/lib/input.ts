// packages/cli/src/lib/input.ts

import { readFileSync } from "node:fs";

/**
 * Read content from stdin (for piped input)
 * Returns empty string if stdin is a TTY (interactive terminal)
 */
export async function readStdin(): Promise<string> {
  // Check if stdin is a TTY (interactive terminal)
  if (process.stdin.isTTY) {
    return "";
  }

  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Read content from a file
 */
export function readContentFile(filePath: string): string {
  try {
    return readFileSync(filePath, "utf-8");
  } catch (err) {
    throw new Error(`Failed to read content file: ${filePath}`);
  }
}

/**
 * Get content from various sources in priority order:
 * 1. Direct content argument
 * 2. Content from file (--content-file)
 * 3. Content from stdin (piped)
 */
export async function getContent(
  directContent: string | undefined,
  contentFile: string | undefined
): Promise<string> {
  // Priority 1: Direct content argument
  if (directContent !== undefined) {
    return directContent;
  }

  // Priority 2: Content from file
  if (contentFile) {
    return readContentFile(contentFile);
  }

  // Priority 3: Content from stdin
  const stdinContent = await readStdin();
  if (stdinContent) {
    return stdinContent;
  }

  // No content provided
  return "";
}
