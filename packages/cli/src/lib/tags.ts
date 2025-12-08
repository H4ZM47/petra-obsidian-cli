// packages/cli/src/lib/tags.ts

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import matter from "gray-matter";
import type { NoteFrontmatter, NoteInfo } from "@petra/shared";
import { requireVault } from "./vault.js";

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

  // Limit content size to prevent ReDoS on huge files (1MB limit)
  const MAX_CONTENT_LENGTH = 1024 * 1024;
  const safeContent = content.slice(0, MAX_CONTENT_LENGTH);

  // Remove code blocks using atomic pattern with reasonable length limits
  // Matches ``` followed by up to 10k chars (non-greedy), then ```
  let cleaned = safeContent.replace(/```[\s\S]{0,10000}?```/g, "");

  // Remove inline code with bounded quantifier (max 500 chars per code span)
  cleaned = cleaned.replace(/`[^`]{0,500}`/g, "");

  // Remove URLs with bounded quantifier (max 2000 chars per URL)
  cleaned = cleaned.replace(/https?:\/\/[^\s)]{0,2000}/g, "");

  // Extract tags with strict pattern and length limit
  // Format: #[letter][alphanumeric/dash/underscore]{0,99}
  const tagPattern = /#([a-zA-Z][a-zA-Z0-9_/-]{0,99})\b/g;
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
 * Get all tags in the vault with their occurrence counts
 */
export function getAllTags(): Map<string, number> {
  const vault = requireVault();
  const tagCounts = new Map<string, number>();

  function scanDir(dir: string): void {
    if (!existsSync(dir)) {
      return;
    }

    const entries = readdirSync(dir);

    for (const entry of entries) {
      // Skip hidden files and .obsidian folder
      if (entry.startsWith(".")) continue;

      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDir(fullPath);
      } else if (entry.endsWith(".md")) {
        try {
          const raw = readFileSync(fullPath, "utf-8");
          const { content, data } = matter(raw);
          const fm = data as NoteFrontmatter;

          const tags = getTagsFromNote(content, fm);

          for (const tag of tags) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
          }
        } catch {
          // Skip files that can't be parsed
        }
      }
    }
  }

  scanDir(vault.path);

  return tagCounts;
}

/**
 * Find notes that contain a specific tag
 */
export function findNotesByTag(
  tag: string,
  options: {
    exact?: boolean;
    limit?: number;
  } = {}
): NoteWithTags[] {
  const vault = requireVault();
  const notes: NoteWithTags[] = [];
  const searchTag = tag.toLowerCase();
  const exact = options.exact ?? false;

  function scanDir(dir: string, relativePath: string = ""): void {
    if (!existsSync(dir)) {
      return;
    }

    const entries = readdirSync(dir);

    for (const entry of entries) {
      // Skip hidden files and .obsidian folder
      if (entry.startsWith(".")) continue;

      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDir(fullPath, join(relativePath, entry));
      } else if (entry.endsWith(".md")) {
        try {
          const raw = readFileSync(fullPath, "utf-8");
          const { content, data } = matter(raw);
          const fm = data as NoteFrontmatter;

          const allTags = getTagsFromNote(content, fm);

          // Check if any tag matches
          const hasMatch = allTags.some((t) => {
            const normalized = t.toLowerCase();
            return exact
              ? normalized === searchTag
              : normalized.includes(searchTag);
          });

          if (hasMatch) {
            const notePath = join(relativePath, entry);
            notes.push({
              path: notePath.replace(/\.md$/, ""),
              title: fm.title || basename(entry, ".md"),
              tags: fm.tags || [],
              allTags,
              created: fm.created,
              modified: fm.modified,
            });
          }
        } catch {
          // Skip files that can't be parsed
        }
      }

      // Check limit
      if (options.limit && notes.length >= options.limit) {
        return;
      }
    }
  }

  scanDir(vault.path);

  // Sort by modified date (most recent first)
  notes.sort((a, b) => {
    const aDate = String(a.modified || a.created || "");
    const bDate = String(b.modified || b.created || "");
    return bDate.localeCompare(aDate);
  });

  if (options.limit) {
    return notes.slice(0, options.limit);
  }

  return notes;
}
