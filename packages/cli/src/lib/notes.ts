// packages/cli/src/lib/notes.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import matter from "gray-matter";
import type { Note, NoteInfo, NoteFrontmatter } from "@petra/shared";
import { notFound, alreadyExists } from "@petra/shared";
import { TRASH_FOLDER } from "@petra/shared";
import { requireVault } from "./vault.js";

/** Normalize note path - add .md if needed, resolve relative paths */
function normalizePath(notePath: string): string {
  let normalized = notePath;

  // Remove leading slash if present
  if (normalized.startsWith("/")) {
    normalized = normalized.slice(1);
  }

  // Add .md extension if not present
  if (!normalized.endsWith(".md")) {
    normalized += ".md";
  }

  return normalized;
}

/** Get full file path for a note */
function getFullPath(notePath: string): string {
  const vault = requireVault();
  return join(vault.path, normalizePath(notePath));
}

/** Create a new note */
export function createNote(
  notePath: string,
  content: string = "",
  frontmatter: NoteFrontmatter = {}
): Note {
  const fullPath = getFullPath(notePath);

  if (existsSync(fullPath)) {
    throw alreadyExists(`Note at ${notePath}`);
  }

  // Ensure directory exists
  const dir = dirname(fullPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Set created date if not provided
  const fm: NoteFrontmatter = {
    created: new Date().toISOString(),
    ...frontmatter,
  };

  // Build file content
  const raw = matter.stringify(content, fm);

  writeFileSync(fullPath, raw, "utf-8");

  return {
    path: normalizePath(notePath).replace(/\.md$/, ""),
    title: fm.title || basename(notePath, ".md"),
    content,
    frontmatter: fm,
    raw,
  };
}

/** Read a note */
export function readNote(notePath: string): Note {
  const fullPath = getFullPath(notePath);

  if (!existsSync(fullPath)) {
    throw notFound(`Note at ${notePath}`);
  }

  const raw = readFileSync(fullPath, "utf-8");
  const { content, data } = matter(raw);
  const fm = data as NoteFrontmatter;

  return {
    path: normalizePath(notePath).replace(/\.md$/, ""),
    title: fm.title || basename(notePath, ".md"),
    content,
    frontmatter: fm,
    raw,
  };
}

/** Update a note */
export function updateNote(
  notePath: string,
  options: { content?: string; append?: string; frontmatter?: NoteFrontmatter }
): Note {
  const existing = readNote(notePath);

  let newContent = existing.content;
  if (options.content !== undefined) {
    newContent = options.content;
  } else if (options.append !== undefined) {
    newContent = existing.content + "\n" + options.append;
  }

  const newFrontmatter: NoteFrontmatter = {
    ...existing.frontmatter,
    ...options.frontmatter,
    modified: new Date().toISOString(),
  };

  const raw = matter.stringify(newContent, newFrontmatter);
  const fullPath = getFullPath(notePath);
  writeFileSync(fullPath, raw, "utf-8");

  return {
    path: existing.path,
    title: newFrontmatter.title || existing.title,
    content: newContent,
    frontmatter: newFrontmatter,
    raw,
  };
}

/** Delete a note */
export function deleteNote(notePath: string, useTrash: boolean = false): void {
  const fullPath = getFullPath(notePath);

  if (!existsSync(fullPath)) {
    throw notFound(`Note at ${notePath}`);
  }

  if (useTrash) {
    const vault = requireVault();
    const trashDir = join(vault.path, TRASH_FOLDER);

    if (!existsSync(trashDir)) {
      mkdirSync(trashDir, { recursive: true });
    }

    const trashPath = join(trashDir, basename(fullPath));
    renameSync(fullPath, trashPath);
  } else {
    unlinkSync(fullPath);
  }
}

/** List notes in vault */
export function listNotes(options: {
  folder?: string;
  limit?: number;
} = {}): NoteInfo[] {
  const vault = requireVault();
  const baseDir = options.folder
    ? join(vault.path, options.folder)
    : vault.path;

  if (!existsSync(baseDir)) {
    return [];
  }

  const notes: NoteInfo[] = [];

  function scanDir(dir: string, relativePath: string = ""): void {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      // Skip hidden files and .obsidian folder
      if (entry.startsWith(".")) continue;

      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        scanDir(fullPath, join(relativePath, entry));
      } else if (entry.endsWith(".md")) {
        const notePath = join(relativePath, entry);
        try {
          const raw = readFileSync(fullPath, "utf-8");
          const { data } = matter(raw);
          const fm = data as NoteFrontmatter;

          notes.push({
            path: notePath.replace(/\.md$/, ""),
            title: fm.title || basename(entry, ".md"),
            tags: fm.tags || [],
            created: fm.created,
            modified: fm.modified,
          });
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

  scanDir(baseDir);

  // Sort by modified date (most recent first)
  notes.sort((a, b) => {
    const aDate = a.modified || a.created || "";
    const bDate = b.modified || b.created || "";
    return bDate.localeCompare(aDate);
  });

  if (options.limit) {
    return notes.slice(0, options.limit);
  }

  return notes;
}
