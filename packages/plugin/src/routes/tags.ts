// packages/plugin/src/routes/tags.ts

import { App } from "obsidian";
import { PetraServer } from "../server";
import type { NoteInfo } from "@petra/shared";

/** Extract tags from frontmatter and inline content */
function extractTags(content: string, frontmatter: Record<string, unknown>): string[] {
  const tags = new Set<string>();

  // Frontmatter tags
  if (Array.isArray(frontmatter.tags)) {
    for (const tag of frontmatter.tags) {
      tags.add(String(tag));
    }
  }

  // Inline tags - remove code blocks first
  let cleaned = content.replace(/```[\s\S]*?```/g, "");
  cleaned = cleaned.replace(/`[^`]*`/g, "");
  cleaned = cleaned.replace(/https?:\/\/[^\s)]+/g, "");

  const tagPattern = /#([a-zA-Z0-9_-]+)/g;
  let match;
  while ((match = tagPattern.exec(cleaned)) !== null) {
    tags.add(match[1]);
  }

  return Array.from(tags);
}

/** Parse frontmatter */
function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

  const yamlStr = match[1];
  const body = match[2];
  const frontmatter: Record<string, unknown> = {};

  for (const line of yamlStr.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      frontmatter[key] = value.slice(1, -1).split(",").map(s => s.trim());
    } else if (value) {
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

/** Register tag routes */
export function registerTagRoutes(server: PetraServer, app: App): void {

  // GET /tags - List all tags with counts
  server.route("GET", "/tags", async (_req, res, _params, _body) => {
    const tagCounts = new Map<string, number>();
    const files = app.vault.getMarkdownFiles();

    for (const file of files) {
      const content = await app.vault.read(file);
      const { frontmatter, body } = parseFrontmatter(content);
      const tags = extractTags(body, frontmatter);

      for (const tag of tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // Convert to sorted array
    const result = Array.from(tagCounts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    server.sendJson(res, { ok: true, data: result });
  });

  // GET /tags/:tag/notes - Get notes with specific tag
  server.route("GET", "/tags/:tag/notes", async (req, res, params, _body) => {
    const searchTag = params.tag.toLowerCase();
    const url = new URL(req.url || "/", "http://localhost");
    const exact = url.searchParams.get("exact") === "true";
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const files = app.vault.getMarkdownFiles();
    const notes: NoteInfo[] = [];

    for (const file of files) {
      if (notes.length >= limit) break;

      const content = await app.vault.read(file);
      const { frontmatter, body } = parseFrontmatter(content);
      const tags = extractTags(body, frontmatter);

      const hasMatch = tags.some(t => {
        const normalized = t.toLowerCase();
        return exact ? normalized === searchTag : normalized.includes(searchTag);
      });

      if (hasMatch) {
        notes.push({
          path: file.path.replace(/\.md$/, ""),
          title: (frontmatter.title as string) || file.basename,
          tags,
          created: frontmatter.created as string,
          modified: frontmatter.modified as string,
        });
      }
    }

    server.sendJson(res, { ok: true, data: notes });
  });
}
