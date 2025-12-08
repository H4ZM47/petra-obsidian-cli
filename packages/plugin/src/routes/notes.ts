// packages/plugin/src/routes/notes.ts

import { App, TFile, TFolder, FileSystemAdapter } from "obsidian";
import { PetraServer } from "../server";
import type { Note, NoteInfo, NoteFrontmatter } from "@petra/shared";
import matter from 'gray-matter';

/** Parse YAML frontmatter from content */
function parseFrontmatter(content: string): { frontmatter: NoteFrontmatter; body: string } {
  const result = matter(content);
  return {
    frontmatter: result.data as NoteFrontmatter,
    body: result.content
  };
}

/** Convert TFile to NoteInfo */
async function fileToNoteInfo(app: App, file: TFile): Promise<NoteInfo> {
  const content = await app.vault.read(file);
  const { frontmatter } = parseFrontmatter(content);

  return {
    path: file.path.replace(/\.md$/, ""),
    title: frontmatter.title as string || file.basename,
    tags: (frontmatter.tags as string[]) || [],
    created: frontmatter.created as string,
    modified: frontmatter.modified as string,
  };
}

/** Convert TFile to full Note */
async function fileToNote(app: App, file: TFile): Promise<Note> {
  const raw = await app.vault.read(file);
  const { frontmatter, body } = parseFrontmatter(raw);

  return {
    path: file.path.replace(/\.md$/, ""),
    title: frontmatter.title as string || file.basename,
    content: body,
    frontmatter,
    raw,
  };
}

/** Normalize path - ensure .md extension */
function normalizePath(path: string): string {
  if (path.startsWith("/")) path = path.slice(1);
  if (!path.endsWith(".md")) path += ".md";
  return path;
}

/**
 * Validate and sanitize user-provided path to prevent path traversal attacks.
 * @param notePath - User-provided note path
 * @param vaultPath - Absolute path to vault root
 * @returns Validated normalized path safe for file operations
 * @throws Error if path attempts traversal or escapes vault
 */
function validatePath(notePath: string, vaultPath: string): string {
  // First normalize the path
  const normalized = normalizePath(notePath);

  // Check for path traversal sequences
  if (normalized.includes('..')) {
    throw new Error('Path traversal not allowed');
  }

  // Ensure the resolved absolute path stays within vault
  // Note: Node's path module is available in Obsidian desktop
  const path = require('path');
  const fullPath = path.resolve(vaultPath, normalized);
  const normalizedVaultPath = path.resolve(vaultPath);

  // Verify resolved path starts with vault root
  if (!fullPath.startsWith(normalizedVaultPath + path.sep) && fullPath !== normalizedVaultPath) {
    throw new Error('Path escapes vault');
  }

  return normalized;
}

/**
 * Get vault root path.
 * Returns the absolute file system path to the vault root on desktop platforms.
 * Returns empty string on mobile or if the adapter is not a FileSystemAdapter.
 */
function getVaultPath(app: App): string {
  const adapter = app.vault.adapter;
  return adapter instanceof FileSystemAdapter ? adapter.basePath : '';
}

/** Register note routes */
export function registerNoteRoutes(server: PetraServer, app: App): void {

  // GET /notes - List notes
  server.route("GET", "/notes", async (req, res, params, body) => {
    const url = new URL(req.url || "/", "http://localhost");
    const folder = url.searchParams.get("folder");
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const tag = url.searchParams.get("tag");

    const files = app.vault.getMarkdownFiles();
    let filtered = files;

    // Filter by folder
    if (folder) {
      filtered = filtered.filter(f => f.path.startsWith(folder));
    }

    // Get note info with frontmatter
    const notes: NoteInfo[] = [];
    for (const file of filtered.slice(0, limit * 2)) { // Get extra to filter by tag
      const info = await fileToNoteInfo(app, file);

      // Filter by tag if specified
      if (tag && !info.tags.includes(tag)) continue;

      notes.push(info);
      if (notes.length >= limit) break;
    }

    server.sendJson(res, { ok: true, data: notes });
  });

  // POST /notes - Create note
  server.route("POST", "/notes", async (req, res, params, body) => {
    const { path, content = "", frontmatter = {} } = body as {
      path: string;
      content?: string;
      frontmatter?: NoteFrontmatter;
    };

    if (!path) {
      server.sendError(res, 400, "INVALID_PATH", "Path is required");
      return;
    }

    let normalizedPath: string;
    try {
      normalizedPath = validatePath(path, getVaultPath(app));
    } catch (error) {
      server.sendError(res, 400, "INVALID_PATH", String(error));
      return;
    }

    const existing = app.vault.getAbstractFileByPath(normalizedPath);

    if (existing) {
      server.sendError(res, 409, "ALREADY_EXISTS", `Note already exists: ${path}`);
      return;
    }

    // Build content with frontmatter
    const fm: NoteFrontmatter = {
      created: new Date().toISOString(),
      ...frontmatter,
    };

    const yamlLines = Object.entries(fm).map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}: [${v.join(", ")}]`;
      }
      return `${k}: ${v}`;
    });

    const fileContent = `---\n${yamlLines.join("\n")}\n---\n${content}`;

    // Ensure parent folder exists
    const folderPath = normalizedPath.split("/").slice(0, -1).join("/");
    if (folderPath) {
      const folder = app.vault.getAbstractFileByPath(folderPath);
      if (!folder) {
        await app.vault.createFolder(folderPath);
      }
    }

    const file = await app.vault.create(normalizedPath, fileContent);
    const note = await fileToNote(app, file);

    server.sendJson(res, { ok: true, data: note });
  });

  // GET /notes/:path - Read note
  server.route("GET", "/notes/:path", async (req, res, params, body) => {
    let path: string;
    try {
      path = validatePath(params.path, getVaultPath(app));
    } catch (error) {
      server.sendError(res, 400, "INVALID_PATH", String(error));
      return;
    }

    const file = app.vault.getAbstractFileByPath(path);

    if (!file || !(file instanceof TFile)) {
      server.sendError(res, 404, "NOT_FOUND", `Note not found: ${params.path}`);
      return;
    }

    const note = await fileToNote(app, file);
    server.sendJson(res, { ok: true, data: note });
  });

  // PUT /notes/:path - Update note
  server.route("PUT", "/notes/:path", async (req, res, params, body) => {
    let path: string;
    try {
      path = validatePath(params.path, getVaultPath(app));
    } catch (error) {
      server.sendError(res, 400, "INVALID_PATH", String(error));
      return;
    }

    const file = app.vault.getAbstractFileByPath(path);

    if (!file || !(file instanceof TFile)) {
      server.sendError(res, 404, "NOT_FOUND", `Note not found: ${params.path}`);
      return;
    }

    const { content, append, frontmatter } = body as {
      content?: string;
      append?: string;
      frontmatter?: NoteFrontmatter;
    };

    const existing = await app.vault.read(file);
    const parsed = parseFrontmatter(existing);

    // Update content
    let newBody = parsed.body;
    if (content !== undefined) {
      newBody = content;
    } else if (append !== undefined) {
      newBody = parsed.body + "\n" + append;
    }

    // Update frontmatter
    const newFm: NoteFrontmatter = {
      ...parsed.frontmatter,
      ...frontmatter,
      modified: new Date().toISOString(),
    };

    const yamlLines = Object.entries(newFm).map(([k, v]) => {
      if (Array.isArray(v)) {
        return `${k}: [${v.join(", ")}]`;
      }
      return `${k}: ${v}`;
    });

    const newContent = `---\n${yamlLines.join("\n")}\n---\n${newBody}`;
    await app.vault.modify(file, newContent);

    const note = await fileToNote(app, file);
    server.sendJson(res, { ok: true, data: note });
  });

  // DELETE /notes/:path - Delete note
  server.route("DELETE", "/notes/:path", async (req, res, params, body) => {
    let path: string;
    try {
      path = validatePath(params.path, getVaultPath(app));
    } catch (error) {
      server.sendError(res, 400, "INVALID_PATH", String(error));
      return;
    }

    const file = app.vault.getAbstractFileByPath(path);

    if (!file || !(file instanceof TFile)) {
      server.sendError(res, 404, "NOT_FOUND", `Note not found: ${params.path}`);
      return;
    }

    await app.vault.trash(file, false); // Move to system trash
    server.sendJson(res, { ok: true, data: { deleted: params.path } });
  });

  // POST /notes/:path/move - Move/rename note
  server.route("POST", "/notes/:path/move", async (req, res, params, body) => {
    let path: string;
    try {
      path = validatePath(params.path, getVaultPath(app));
    } catch (error) {
      server.sendError(res, 400, "INVALID_PATH", String(error));
      return;
    }

    const file = app.vault.getAbstractFileByPath(path);

    if (!file || !(file instanceof TFile)) {
      server.sendError(res, 404, "NOT_FOUND", `Note not found: ${params.path}`);
      return;
    }

    const { newPath } = body as { newPath: string };
    if (!newPath) {
      server.sendError(res, 400, "INVALID_PATH", "newPath is required");
      return;
    }

    let normalizedNewPath: string;
    try {
      normalizedNewPath = validatePath(newPath, getVaultPath(app));
    } catch (error) {
      server.sendError(res, 400, "INVALID_PATH", String(error));
      return;
    }

    // Use fileManager for link-aware rename
    await app.fileManager.renameFile(file, normalizedNewPath);

    const newFile = app.vault.getAbstractFileByPath(normalizedNewPath);
    if (newFile instanceof TFile) {
      const note = await fileToNote(app, newFile);
      server.sendJson(res, { ok: true, data: note });
    } else {
      server.sendJson(res, { ok: true, data: { moved: newPath } });
    }
  });
}
