// packages/shared/src/frontmatter.ts
// Consolidated frontmatter parsing for CLI and plugin

import matter from "gray-matter";

export interface ParsedFrontmatter {
  data: Record<string, unknown>;
  content: string;
}

/**
 * Parse frontmatter from markdown content.
 * Uses gray-matter for robust YAML parsing.
 */
export function parseFrontmatter(raw: string): ParsedFrontmatter {
  try {
    const result = matter(raw);
    return {
      data: result.data as Record<string, unknown>,
      content: result.content,
    };
  } catch {
    // If parsing fails, return empty frontmatter and full content
    return {
      data: {},
      content: raw,
    };
  }
}

/**
 * Stringify content with frontmatter.
 */
export function stringifyFrontmatter(
  content: string,
  frontmatter: Record<string, unknown>
): string {
  return matter.stringify(content, frontmatter);
}
