// packages/cli/src/lib/tags.ts

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import matter from "gray-matter";
import type { NoteFrontmatter, NoteInfo } from "@petra/shared";
import { requireVault } from "./vault.js";
import { getCache, syncCache } from "./cache.js";

/** Tag information with note count */
export interface TagInfo {
  tag: string;
  count: number;
}

/** Note with tag information */
export interface NoteWithTags extends NoteInfo {
  allTags: string[];
}

/**
 * Extract inline tags from markdown content
 * Excludes tags in code blocks, inline code, and URLs
 */
function extractInlineTags(content: string): string[] {
  const tags = new Set<string>();

  // Remove code blocks (```...```)
  let cleaned = content.replace(/```[\s\S]*?```/g, "");

  // Remove inline code (`...`)
  cleaned = cleaned.replace(/`[^`]*`/g, "");

  // Remove URLs to avoid matching fragments
  cleaned = cleaned.replace(/https?:\/\/[^\s)]+/g, "");

  // Extract tags with pattern #[a-zA-Z0-9_-]+
  const tagPattern = /#([a-zA-Z0-9_-]+)/g;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(cleaned)) !== null) {
    tags.add(match[1]);
  }

  return Array.from(tags);
}

/**
 * Extract all tags from a note (frontmatter + inline)
 */
export function getTagsFromNote(
  content: string,
  frontmatter: NoteFrontmatter
): string[] {
  const tags = new Set<string>();

  // Add frontmatter tags
  if (frontmatter.tags && Array.isArray(frontmatter.tags)) {
    for (const tag of frontmatter.tags) {
      tags.add(String(tag));
    }
  }

  // Add inline tags
  const inlineTags = extractInlineTags(content);
  for (const tag of inlineTags) {
    tags.add(tag);
  }

  return Array.from(tags).sort();
}

/**
 * Get all tags in the vault with their occurrence counts (uses cache)
 */
export function getAllTags(): Map<string, number> {
  // Sync cache to ensure it's up to date
  syncCache();

  const cache = getCache();
  return cache.getAllTags();
}

/**
 * Find notes that contain a specific tag (uses cache)
 */
export function findNotesByTag(
  tag: string,
  options: {
    exact?: boolean;
    limit?: number;
  } = {}
): NoteWithTags[] {
  // Sync cache to ensure it's up to date
  syncCache();

  const cache = getCache();
  const notes = cache.getNotesByTag(tag, {
    exactMatch: options.exact ?? true,
    limit: options.limit,
  });

  // Convert NoteInfo to NoteWithTags (allTags = tags from frontmatter for now)
  return notes.map((note) => ({
    ...note,
    allTags: note.tags,
  }));
}
