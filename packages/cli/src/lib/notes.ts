// packages/cli/src/lib/notes.ts

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, renameSync, readdirSync, statSync, lstatSync } from "node:fs";
import { join, dirname, basename, normalize, resolve } from "node:path";
import matter from "gray-matter";
import type { Note, NoteInfo, NoteFrontmatter, SearchResult, SearchMatch } from "@petra/shared";
import { notFound, alreadyExists, invalidPath } from "@petra/shared";
import { TRASH_FOLDER } from "@petra/shared";
import { requireVault } from "./vault.js";
import { getCache, syncCache } from "./cache.js";

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

/** List notes in vault (uses cache for performance) */
export function listNotes(options: {
  folder?: string;
  limit?: number;
} = {}): NoteInfo[] {
  // Sync cache to ensure it's up to date
  syncCache();

  const cache = getCache();
  return cache.listNotes(options);
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

/** Search notes in vault (uses cache FTS for performance) */
export function searchNotes(
  query: string,
  options: {
    folder?: string;
    limit?: number;
    caseSensitive?: boolean;
  } = {}
): SearchResult[] {
  // Sync cache to ensure it's up to date
  syncCache();

  const cache = getCache();
  return cache.searchContent(query, {
    folder: options.folder,
    limit: options.limit,
  });
}
