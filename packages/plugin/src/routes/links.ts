// packages/plugin/src/routes/links.ts

import { App, TFile } from "obsidian";
import { PetraServer } from "../server";
import type { NoteInfo, NoteFrontmatter } from "@petra/shared";

interface LinkInfo {
  path: string;
  title: string;
  exists: boolean;
  context?: string; // Text around the link
}

interface BacklinkInfo extends NoteInfo {
  context: string;
}

/** Parse YAML frontmatter from content */
function parseFrontmatter(content: string): NoteFrontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatter: NoteFrontmatter = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    // Handle arrays like tags: [a, b, c]
    if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[key] = value.slice(1, -1).split(",").map(s => s.trim());
    } else if (value) {
      frontmatter[key] = value;
    }
  }

  return frontmatter;
}

/** Normalize path - ensure .md extension */
function normalizePath(path: string): string {
  if (path.startsWith("/")) path = path.slice(1);
  if (!path.endsWith(".md")) path += ".md";
  return path;
}

/** Escape special regex characters in a string */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extract context around a link in content */
function getContext(content: string, linkText: string, maxLen: number = 100): string {
  const idx = content.indexOf(linkText);
  if (idx === -1) return "";

  const start = Math.max(0, idx - 30);
  const end = Math.min(content.length, idx + linkText.length + 30);
  let context = content.slice(start, end).replace(/\n/g, " ").trim();

  if (start > 0) context = "..." + context;
  if (end < content.length) context = context + "...";

  return context;
}

/** Register link routes */
export function registerLinkRoutes(server: PetraServer, app: App): void {

  // GET /notes/:path/backlinks - Notes linking TO this note
  server.route("GET", "/notes/:path/backlinks", async (req, res, params, body) => {
    const targetPath = normalizePath(params.path);
    const targetFile = app.vault.getAbstractFileByPath(targetPath);

    if (!(targetFile instanceof TFile)) {
      server.sendError(res, 404, "NOT_FOUND", `Note not found: ${params.path}`);
      return;
    }

    const backlinks: BacklinkInfo[] = [];
    const files = app.vault.getMarkdownFiles();
    const targetBasename = targetFile.basename;
    const escapedBasename = escapeRegex(targetBasename);
    const escapedPath = escapeRegex(targetPath.replace(".md", ""));

    for (const file of files) {
      if (file.path === targetPath) continue; // Skip self

      const content = await app.vault.read(file);
      const fm = parseFrontmatter(content);

      // Check for wikilinks [[target]] or [[target|alias]]
      const wikiPattern = new RegExp(`\\[\\[${escapedBasename}(\\|[^\\]]+)?\\]\\]`, "gi");
      // Check for markdown links [text](path)
      const mdPattern = new RegExp(`\\[([^\\]]+)\\]\\(${escapedPath}(\\.md)?\\)`, "gi");

      const wikiMatch = content.match(wikiPattern);
      const mdMatch = content.match(mdPattern);

      if (wikiMatch || mdMatch) {
        const linkText = wikiMatch?.[0] || mdMatch?.[0] || "";

        backlinks.push({
          path: file.path.replace(/\.md$/, ""),
          title: (fm.title as string) || file.basename,
          tags: (fm.tags as string[]) || [],
          created: fm.created as string,
          modified: fm.modified as string,
          context: getContext(content, linkText),
        });
      }
    }

    server.sendJson(res, { ok: true, data: backlinks });
  });

  // GET /notes/:path/outlinks - Notes this note links TO
  server.route("GET", "/notes/:path/outlinks", async (req, res, params, body) => {
    const sourcePath = normalizePath(params.path);
    const sourceFile = app.vault.getAbstractFileByPath(sourcePath);

    if (!(sourceFile instanceof TFile)) {
      server.sendError(res, 404, "NOT_FOUND", `Note not found: ${params.path}`);
      return;
    }

    const content = await app.vault.read(sourceFile);
    const outlinks: LinkInfo[] = [];
    const seen = new Set<string>();

    // Extract wikilinks [[page]] or [[page|alias]]
    const wikiPattern = /\[\[([^\]|]+)(\|[^\]]+)?\]\]/g;
    let match;
    while ((match = wikiPattern.exec(content)) !== null) {
      const linkTarget = match[1].trim();
      if (seen.has(linkTarget)) continue;
      seen.add(linkTarget);

      // Try to resolve the link
      const resolved = app.metadataCache.getFirstLinkpathDest(linkTarget, sourcePath);

      outlinks.push({
        path: resolved ? resolved.path.replace(/\.md$/, "") : linkTarget,
        title: resolved ? resolved.basename : linkTarget,
        exists: resolved !== null,
        context: getContext(content, match[0]),
      });
    }

    // Extract markdown links [text](path)
    const mdPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
    while ((match = mdPattern.exec(content)) !== null) {
      const linkPath = match[2].trim();

      // Skip external links
      if (linkPath.startsWith("http://") || linkPath.startsWith("https://")) continue;

      if (seen.has(linkPath)) continue;
      seen.add(linkPath);

      const normalizedLink = linkPath.endsWith(".md") ? linkPath : linkPath + ".md";
      const targetFile = app.vault.getAbstractFileByPath(normalizedLink);

      outlinks.push({
        path: linkPath.replace(/\.md$/, ""),
        title: match[1] || linkPath,
        exists: targetFile !== null,
        context: getContext(content, match[0]),
      });
    }

    server.sendJson(res, { ok: true, data: outlinks });
  });
}
