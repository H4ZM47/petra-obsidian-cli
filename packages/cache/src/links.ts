// packages/cache/src/links.ts

export interface ExtractedLink {
  target: string;
  type: "wiki" | "markdown";
}

/** Extract wikilinks and markdown links from content */
export function extractLinks(content: string): ExtractedLink[] {
  const links: ExtractedLink[] = [];
  const seen = new Set<string>();

  // Wikilinks: [[target]] or [[target|alias]]
  const wikiMatches = content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
  for (const match of wikiMatches) {
    const target = match[1].trim();
    const key = `wiki:${target}`;
    if (!seen.has(key)) {
      seen.add(key);
      links.push({ target, type: "wiki" });
    }
  }

  // Markdown links: [text](target) - without external URLs
  const mdMatches = content.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g);
  for (const match of mdMatches) {
    const href = match[2].trim();
    if (!href.startsWith("http://") && !href.startsWith("https://") && !href.startsWith("#")) {
      // Remove .md and anchor fragments
      const target = href.replace(/\.md$/, "").split("#")[0];
      const key = `md:${target}`;
      if (target && !seen.has(key)) {
        seen.add(key);
        links.push({ target, type: "markdown" });
      }
    }
  }

  return links;
}

/** Extract inline tags from markdown content */
export function extractInlineTags(content: string): string[] {
  const tags = new Set<string>();

  // Remove code blocks
  let cleaned = content.replace(/```[\s\S]*?```/g, "");
  // Remove inline code
  cleaned = cleaned.replace(/`[^`]*`/g, "");
  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s)]+/g, "");

  // Extract tags
  const tagMatches = cleaned.matchAll(/#([a-zA-Z0-9_/-]+)/g);
  for (const match of tagMatches) {
    tags.add(match[1]);
  }

  return Array.from(tags);
}
