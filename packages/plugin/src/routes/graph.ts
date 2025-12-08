// packages/plugin/src/routes/graph.ts

import { App, TFile } from "obsidian";
import { PetraServer } from "../server";

interface GraphNode {
  id: string;       // Note path without .md
  title: string;
  group?: string;   // Folder name for grouping
}

interface GraphEdge {
  source: string;   // Path of source note
  target: string;   // Path of target note
  type: "wiki" | "markdown";
}

interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** Register graph routes */
export function registerGraphRoutes(server: PetraServer, app: App): void {

  // POST /graph/query - Query the link graph
  server.route("POST", "/graph/query", async (_req, res, _params, body) => {
    const {
      from,           // Starting note path (optional)
      depth = 1,      // How many hops to traverse
      direction = "both"  // "in", "out", or "both"
    } = body as {
      from?: string;
      depth?: number;
      direction?: "in" | "out" | "both";
    };

    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const visited = new Set<string>();
    const files = app.vault.getMarkdownFiles();

    // Build a quick lookup of all files
    const fileMap = new Map<string, TFile>();
    for (const file of files) {
      fileMap.set(file.path, file);
      fileMap.set(file.basename, file);
    }

    // Helper to extract links from content
    function extractLinks(content: string): Array<{ target: string; type: "wiki" | "markdown" }> {
      const links: Array<{ target: string; type: "wiki" | "markdown" }> = [];

      // Wikilinks
      const wikiPattern = /\[\[([^\]|]+)(\|[^\]]+)?\]\]/g;
      let match;
      while ((match = wikiPattern.exec(content)) !== null) {
        links.push({ target: match[1].trim(), type: "wiki" });
      }

      // Markdown links (exclude external)
      const mdPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      while ((match = mdPattern.exec(content)) !== null) {
        const href = match[2].trim();
        if (!href.startsWith("http://") && !href.startsWith("https://")) {
          links.push({ target: href.replace(/\.md$/, ""), type: "markdown" });
        }
      }

      return links;
    }

    // Add a node to the graph
    function addNode(file: TFile) {
      const id = file.path.replace(/\.md$/, "");
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          title: file.basename,
          group: file.parent?.path || "",
        });
      }
    }

    // BFS traversal
    async function traverse(startPath: string, currentDepth: number) {
      if (currentDepth > depth) return;
      if (visited.has(startPath)) return;
      visited.add(startPath);

      const file = fileMap.get(startPath) || fileMap.get(startPath + ".md");
      if (!file) return;

      addNode(file);
      const content = await app.vault.read(file);
      const fileId = file.path.replace(/\.md$/, "");

      // Outgoing links
      if (direction === "out" || direction === "both") {
        const links = extractLinks(content);
        for (const link of links) {
          const targetFile = fileMap.get(link.target) || fileMap.get(link.target + ".md");
          if (targetFile) {
            addNode(targetFile);
            const targetId = targetFile.path.replace(/\.md$/, "");
            edges.push({ source: fileId, target: targetId, type: link.type });
            await traverse(targetFile.path, currentDepth + 1);
          }
        }
      }

      // Incoming links (backlinks)
      if (direction === "in" || direction === "both") {
        for (const otherFile of files) {
          if (otherFile.path === file.path) continue;
          const otherContent = await app.vault.read(otherFile);
          const links = extractLinks(otherContent);

          for (const link of links) {
            const resolvedFile = fileMap.get(link.target) || fileMap.get(link.target + ".md");
            if (resolvedFile?.path === file.path) {
              addNode(otherFile);
              const sourceId = otherFile.path.replace(/\.md$/, "");
              edges.push({ source: sourceId, target: fileId, type: link.type });
              await traverse(otherFile.path, currentDepth + 1);
            }
          }
        }
      }
    }

    // Start traversal
    if (from) {
      await traverse(from, 0);
    } else {
      // No starting point - return entire graph (limited)
      for (const file of files.slice(0, 100)) {
        addNode(file);
        const content = await app.vault.read(file);
        const fileId = file.path.replace(/\.md$/, "");
        const links = extractLinks(content);

        for (const link of links) {
          const targetFile = fileMap.get(link.target) || fileMap.get(link.target + ".md");
          if (targetFile) {
            addNode(targetFile);
            const targetId = targetFile.path.replace(/\.md$/, "");
            edges.push({ source: fileId, target: targetId, type: link.type });
          }
        }
      }
    }

    const result: GraphResult = {
      nodes: Array.from(nodes.values()),
      edges: edges,
    };

    server.sendJson(res, { ok: true, data: result });
  });

  // GET /graph/neighbors/:path - Get immediate neighbors of a note
  server.route("GET", "/graph/neighbors/:path", async (req, res, params, _body) => {
    const url = new URL(req.url || "/", "http://localhost");
    const depthParam = parseInt(url.searchParams.get("depth") || "1");
    const direction = (url.searchParams.get("direction") || "both") as "in" | "out" | "both";

    // Re-use the query logic by calling the route handler
    // For simplicity, we'll duplicate the core logic
    const files = app.vault.getMarkdownFiles();
    const fileMap = new Map<string, TFile>();
    for (const file of files) {
      fileMap.set(file.path, file);
      fileMap.set(file.basename, file);
    }

    const normalizedPath = params.path.endsWith(".md") ? params.path : params.path + ".md";
    const centerFile = app.vault.getAbstractFileByPath(normalizedPath);

    if (!(centerFile instanceof TFile)) {
      server.sendError(res, 404, "NOT_FOUND", `Note not found: ${params.path}`);
      return;
    }

    const neighbors: Array<{ path: string; title: string; direction: "in" | "out" }> = [];
    const content = await app.vault.read(centerFile);

    // Extract wikilinks for outgoing
    if (direction === "out" || direction === "both") {
      const wikiPattern = /\[\[([^\]|]+)(\|[^\]]+)?\]\]/g;
      let match;
      while ((match = wikiPattern.exec(content)) !== null) {
        const target = match[1].trim();
        const targetFile = fileMap.get(target) || fileMap.get(target + ".md");
        if (targetFile) {
          neighbors.push({
            path: targetFile.path.replace(/\.md$/, ""),
            title: targetFile.basename,
            direction: "out",
          });
        }
      }
    }

    // Check all files for incoming links
    if (direction === "in" || direction === "both") {
      for (const file of files) {
        if (file.path === centerFile.path) continue;
        const fileContent = await app.vault.read(file);

        const wikiPattern = new RegExp(`\\[\\[${centerFile.basename}(\\|[^\\]]+)?\\]\\]`, "i");
        if (wikiPattern.test(fileContent)) {
          neighbors.push({
            path: file.path.replace(/\.md$/, ""),
            title: file.basename,
            direction: "in",
          });
        }
      }
    }

    server.sendJson(res, { ok: true, data: neighbors });
  });
}
