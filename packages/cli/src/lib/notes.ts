// packages/cli/src/lib/notes.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync, readdirSync, statSync, lstatSync } from "node:fs";
import { join, dirname, basename, normalize, resolve } from "node:path";
import matter from "gray-matter";
import type { Note, NoteInfo, NoteFrontmatter, SearchResult, SearchMatch } from "@petra/shared";
import { notFound, alreadyExists, invalidPath } from "@petra/shared";
import { TRASH_FOLDER } from "@petra/shared";
import { requireVault } from "./vault.js";

/** Maximum directory depth to prevent stack overflow */
const MAX_SCAN_DEPTH = 20;

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

/**
 * Validate and sanitize a path to prevent path traversal attacks.
 * Ensures the final path stays within the vault root.
 * Rejects any path containing '..' to prevent traversal attempts.
 */
function safePath(notePath: string, vaultRoot: string): string {
  // Normalize the path first
  const normalized = normalize(notePath);

  // Reject any path containing '..' (path traversal attempt)
  if (normalized.includes('..')) {
    throw invalidPath(notePath);
  }

  // Join with vault root and resolve to absolute path
  const fullPath = resolve(vaultRoot, normalized);
  const resolvedVaultRoot = resolve(vaultRoot);

  // Verify the final path starts with vault root (defense in depth)
  if (!fullPath.startsWith(resolvedVaultRoot + '/') && fullPath !== resolvedVaultRoot) {
    throw invalidPath(notePath);
  }

  return fullPath;
}

/** Get full file path for a note */
function getFullPath(notePath: string): string {
  const vault = requireVault();
  const normalized = normalizePath(notePath);
  return safePath(normalized, vault.path);
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
    // Only add newline separator if content doesn't already end with newline
    const separator = existing.content.endsWith('\n') ? '' : '\n';
    newContent = existing.content + separator + options.append;
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

/**
 * Generate a unique trash path with timestamp to prevent collisions.
 * Files with the same basename from different folders get unique names.
 */
function getUniqueTrashPath(originalPath: string, trashDir: string): string {
  const base = basename(originalPath);
  const ext = base.endsWith('.md') ? '.md' : '';
  const name = ext ? base.slice(0, -ext.length) : base;
  const timestamp = Date.now();
  return join(trashDir, `${name}-${timestamp}${ext}`);
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

    const trashPath = getUniqueTrashPath(fullPath, trashDir);
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
    ? safePath(options.folder, vault.path)
    : vault.path;

  if (!existsSync(baseDir)) {
    return [];
  }

  const notes: NoteInfo[] = [];

  function scanDir(dir: string, relativePath: string = "", depth: number = 0): void {
    // Stop recursion if max depth reached
    if (depth > MAX_SCAN_DEPTH) {
      return;
    }

    const entries = readdirSync(dir);

    for (const entry of entries) {
      // Skip hidden files and .obsidian folder
      if (entry.startsWith(".")) continue;

      const fullPath = join(dir, entry);

      // Use lstat to detect symlinks without following them
      let stat;
      try {
        stat = lstatSync(fullPath);
      } catch {
        // Skip files we can't stat
        continue;
      }

      // Skip symlinks to prevent infinite loops
      if (stat.isSymbolicLink()) {
        continue;
      }

      if (stat.isDirectory()) {
        scanDir(fullPath, join(relativePath, entry), depth + 1);
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
    const aDate = String(a.modified || a.created || "");
    const bDate = String(b.modified || b.created || "");
    return bDate.localeCompare(aDate);
  });

  if (options.limit) {
    return notes.slice(0, options.limit);
  }

  return notes;
}

/** Move/rename a note */
export function moveNote(fromPath: string, toPath: string, force: boolean = false): Note {
  const fullFromPath = getFullPath(fromPath);
  const fullToPath = getFullPath(toPath);

  // Check source exists
  if (!existsSync(fullFromPath)) {
    throw notFound(`Note at ${fromPath}`);
  }

  // Check destination doesn't exist (unless force)
  if (existsSync(fullToPath) && !force) {
    throw alreadyExists(`Note at ${toPath}`);
  }

  // Ensure destination directory exists
  const destDir = dirname(fullToPath);
  if (!existsSync(destDir)) {
    mkdirSync(destDir, { recursive: true });
  }

  // Move the file
  renameSync(fullFromPath, fullToPath);

  // Read and return the note from its new location
  return readNote(toPath);
}

/** Search notes in vault */
export function searchNotes(
  query: string,
  options: {
    folder?: string;
    limit?: number;
    caseSensitive?: boolean;
  } = {}
): SearchResult[] {
  const vault = requireVault();
  const baseDir = options.folder
    ? safePath(options.folder, vault.path)
    : vault.path;

  if (!existsSync(baseDir)) {
    return [];
  }

  const results: SearchResult[] = [];
  const searchQuery = options.caseSensitive ? query : query.toLowerCase();

  function scanDir(dir: string, relativePath: string = "", depth: number = 0): void {
    // Stop recursion if max depth reached
    if (depth > MAX_SCAN_DEPTH) {
      return;
    }

    const entries = readdirSync(dir);

    for (const entry of entries) {
      // Skip hidden files and .obsidian folder
      if (entry.startsWith(".")) continue;

      const fullPath = join(dir, entry);

      // Use lstat to detect symlinks without following them
      let stat;
      try {
        stat = lstatSync(fullPath);
      } catch {
        // Skip files we can't stat
        continue;
      }

      // Skip symlinks to prevent infinite loops
      if (stat.isSymbolicLink()) {
        continue;
      }

      if (stat.isDirectory()) {
        scanDir(fullPath, join(relativePath, entry), depth + 1);
      } else if (entry.endsWith(".md")) {
        const notePath = join(relativePath, entry);
        try {
          const raw = readFileSync(fullPath, "utf-8");
          const { content, data } = matter(raw);
          const fm = data as NoteFrontmatter;

          const matches: SearchMatch[] = [];

          // Search in content
          const contentLines = content.split("\n");
          for (let i = 0; i < contentLines.length; i++) {
            const line = contentLines[i];
            const searchLine = options.caseSensitive ? line : line.toLowerCase();

            if (searchLine.includes(searchQuery)) {
              matches.push({
                line: i + 1,
                text: line.trim(),
              });
            }
          }

          // Search in frontmatter (convert to string for searching)
          const frontmatterStr = JSON.stringify(fm);
          const searchFrontmatter = options.caseSensitive
            ? frontmatterStr
            : frontmatterStr.toLowerCase();

          if (searchFrontmatter.includes(searchQuery)) {
            // Add a special match for frontmatter
            matches.push({
              line: 0,
              text: `[frontmatter] ${Object.entries(fm)
                .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                .join(", ")}`,
            });
          }

          // If we found matches, add to results
          if (matches.length > 0) {
            results.push({
              note: {
                path: notePath.replace(/\.md$/, ""),
                title: fm.title || basename(entry, ".md"),
                tags: fm.tags || [],
                created: fm.created,
                modified: fm.modified,
              },
              matches,
            });
          }
        } catch {
          // Skip files that can't be parsed
        }
      }

      // Check limit
      if (options.limit && results.length >= options.limit) {
        return;
      }
    }
  }

  scanDir(baseDir);

  // Sort by number of matches (most matches first)
  results.sort((a, b) => b.matches.length - a.matches.length);

  if (options.limit) {
    return results.slice(0, options.limit);
  }

  return results;
}
