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
  truncated?: boolean;      // True if results were limited
  processedFiles?: number;  // Number of files actually processed
  totalFiles?: number;      // Total files in vault
}

/** Register graph routes */
export function registerGraphRoutes(server: PetraServer, app: App): void {

  // POST /graph/query - Query the link graph
  server.route("POST", "/graph/query", async (_req, res, _params, body) => {
    const {
      from,           // Starting note path (optional)
      depth = 1,      // How many hops to traverse
      direction = "both",  // "in", "out", or "both"
      maxNodes = 1000,    // Maximum number of nodes to process
      timeout = 5000  // Timeout in milliseconds
    } = body as {
      from?: string;
      depth?: number;
      direction?: "in" | "out" | "both";
      maxNodes?: number;
      timeout?: number;
    };

    // Enforce safety limits to prevent infinite loops and resource exhaustion
    const MAX_DEPTH = 50;
    const MAX_NODES = 10000;
    const MAX_TIMEOUT = 30000; // 30 seconds max

    const safeDepth = Math.min(Math.max(0, depth), MAX_DEPTH);
    const safeMaxNodes = Math.min(Math.max(1, maxNodes), MAX_NODES);
    const safeTimeout = Math.min(Math.max(1000, timeout), MAX_TIMEOUT);

    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];
    const visited = new Set<string>();
    const files = app.vault.getMarkdownFiles();

    // Performance tracking
    let truncated = false;
    const startTime = Date.now();

    // Build a quick lookup of all files
    const fileMap = new Map<string, TFile>();
    for (const file of files) {
      fileMap.set(file.path, file);
      fileMap.set(file.basename, file);
    }

    // Build inverted index for backlinks (only if needed)
    // Maps target path -> array of source files that link to it
    const backlinksIndex = new Map<string, Array<{ file: TFile; type: "wiki" | "markdown" }>>();

    async function buildBacklinksIndex() {
      // Only build if we need incoming links
      if (direction !== "in" && direction !== "both") return;

      const filesToIndex = files.slice(0, Math.min(files.length, safeMaxNodes));
      for (const file of filesToIndex) {
        // Check timeout
        if (Date.now() - startTime > safeTimeout) {
          truncated = true;
          break;
        }

        const content = await app.vault.read(file);
        const links = extractLinks(content);

        for (const link of links) {
          const targetFile = fileMap.get(link.target) || fileMap.get(link.target + ".md");
          if (targetFile) {
            const targetPath = targetFile.path;
            if (!backlinksIndex.has(targetPath)) {
              backlinksIndex.set(targetPath, []);
            }
            backlinksIndex.get(targetPath)!.push({ file, type: link.type });
          }
        }
      }
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
    function addNode(file: TFile): boolean {
      // Check max nodes limit
      if (nodes.size >= safeMaxNodes) {
        truncated = true;
        return false;
      }

      const id = file.path.replace(/\.md$/, "");
      if (!nodes.has(id)) {
        nodes.set(id, {
          id,
          title: file.basename,
          group: file.parent?.path || "",
        });
      }
      return true;
    }

    // BFS traversal with proper bounds checking
    async function traverse(startPath: string, currentDepth: number): Promise<boolean> {
      // Check depth limit BEFORE processing (prevents stack overflow)
      if (currentDepth > safeDepth) {
        return true; // Continue processing other branches
      }

      // Check timeout
      if (Date.now() - startTime > safeTimeout) {
        truncated = true;
        return false; // Signal to stop all processing
      }

      // Check if already visited (prevents infinite loops in cyclic graphs)
      if (visited.has(startPath)) {
        return true;
      }

      // Check max nodes limit
      if (nodes.size >= safeMaxNodes) {
        truncated = true;
        return false;
      }

      visited.add(startPath);

      const file = fileMap.get(startPath) || fileMap.get(startPath + ".md");
      if (!file) return true;

      // Add node and check limit
      if (!addNode(file)) {
        return false;
      }

      const content = await app.vault.read(file);
      const fileId = file.path.replace(/\.md$/, "");

      // Outgoing links
      if (direction === "out" || direction === "both") {
        const links = extractLinks(content);
        for (const link of links) {
          const targetFile = fileMap.get(link.target) || fileMap.get(link.target + ".md");
          if (targetFile) {
            // Add node first (checking limit)
            if (!addNode(targetFile)) {
              return false;
            }

            const targetId = targetFile.path.replace(/\.md$/, "");

            // Check if edge already exists to avoid duplicates
            const edgeExists = edges.some(e => e.source === fileId && e.target === targetId);
            if (!edgeExists) {
              edges.push({ source: fileId, target: targetId, type: link.type });
            }

            const shouldContinue = await traverse(targetFile.path, currentDepth + 1);
            if (!shouldContinue) return false;
          }
        }
      }

      // Incoming links (backlinks) - use the index to avoid scanning all files
      if (direction === "in" || direction === "both") {
        const backlinks = backlinksIndex.get(file.path) || [];
        for (const { file: sourceFile, type } of backlinks) {
          if (sourceFile.path === file.path) continue;

          // Add node first (checking limit)
          if (!addNode(sourceFile)) {
            return false;
          }

          const sourceId = sourceFile.path.replace(/\.md$/, "");

          // Check if edge already exists to avoid duplicates
          const edgeExists = edges.some(e => e.source === sourceId && e.target === fileId);
          if (!edgeExists) {
            edges.push({ source: sourceId, target: fileId, type });
          }

          const shouldContinue = await traverse(sourceFile.path, currentDepth + 1);
          if (!shouldContinue) return false;
        }
      }

      return true;
    }

    // Build backlinks index if needed for incoming links traversal
    if (from && (direction === "in" || direction === "both")) {
      await buildBacklinksIndex();
    }

    // Start traversal
    if (from) {
      await traverse(from, 0);
    } else {
      // No starting point - return entire graph (limited)
      const limitForFullGraph = Math.min(100, safeMaxNodes);
      for (const file of files.slice(0, limitForFullGraph)) {
        // Check timeout
        if (Date.now() - startTime > safeTimeout) {
          truncated = true;
          break;
        }

        if (!addNode(file)) break;

        const content = await app.vault.read(file);
        const fileId = file.path.replace(/\.md$/, "");
        const links = extractLinks(content);

        for (const link of links) {
          const targetFile = fileMap.get(link.target) || fileMap.get(link.target + ".md");
          if (targetFile) {
            if (!addNode(targetFile)) {
              truncated = true;
              break;
            }
            const targetId = targetFile.path.replace(/\.md$/, "");
            edges.push({ source: fileId, target: targetId, type: link.type });
          }
        }

        if (truncated) break;
      }
      if (limitForFullGraph < files.length) {
        truncated = true;
      }
    }

    const result: GraphResult = {
      nodes: Array.from(nodes.values()),
      edges: edges,
      truncated,
      processedNodes: nodes.size,
      totalFiles: files.length,
    };

    server.sendJson(res, { ok: true, data: result });
  });

  // GET /graph/neighbors/:path - Get immediate neighbors of a note
  server.route("GET", "/graph/neighbors/:path", async (req, res, params, _body) => {
    const url = new URL(req.url || "/", "http://localhost");
    const depthParam = parseInt(url.searchParams.get("depth") || "1");
    const direction = (url.searchParams.get("direction") || "both") as "in" | "out" | "both";

    // Enforce depth limit for neighbors endpoint (currently unused but good to have)
    const MAX_NEIGHBOR_DEPTH = 10;
    const safeDepth = Math.min(Math.max(1, depthParam), MAX_NEIGHBOR_DEPTH);

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
    const startTime = Date.now();
    let truncated = false;

    // Helper to extract links
    function extractLinks(content: string): Array<{ target: string; type: "wiki" | "markdown" }> {
      const links: Array<{ target: string; type: "wiki" | "markdown" }> = [];

      // Wikilinks
      const wikiPattern = /\[\[([^\]|]+)(\|[^\]]+)?\]\]/g;
      let match;
      while ((match = wikiPattern.exec(content)) !== null) {
        links.push({ target: match[1].trim(), type: "wiki" });
      }

      // Markdown links
      const mdPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      while ((match = mdPattern.exec(content)) !== null) {
        const href = match[2].trim();
        if (!href.startsWith("http://") && !href.startsWith("https://")) {
          links.push({ target: href.replace(/\.md$/, ""), type: "markdown" });
        }
      }

      return links;
    }

    // Extract outgoing links
    if (direction === "out" || direction === "both") {
      const links = extractLinks(content);
      for (const link of links) {
        const targetFile = fileMap.get(link.target) || fileMap.get(link.target + ".md");
        if (targetFile) {
          neighbors.push({
            path: targetFile.path.replace(/\.md$/, ""),
            title: targetFile.basename,
            direction: "out",
          });
        }
      }
    }

    // Build backlinks index for incoming links (optimized)
    if (direction === "in" || direction === "both") {
      const maxFiles = Math.min(files.length, limit);
      let processedCount = 0;

      for (const file of files) {
        // Check limits
        if (Date.now() - startTime > timeout) {
          truncated = true;
          break;
        }
        if (processedCount >= maxFiles) {
          truncated = true;
          break;
        }

        if (file.path === centerFile.path) continue;

        processedCount++;
        const fileContent = await app.vault.read(file);
        const links = extractLinks(fileContent);

        // Check if any link points to our center file
        for (const link of links) {
          const targetFile = fileMap.get(link.target) || fileMap.get(link.target + ".md");
          if (targetFile?.path === centerFile.path) {
            neighbors.push({
              path: file.path.replace(/\.md$/, ""),
              title: file.basename,
              direction: "in",
            });
            break; // Only need to add once per file
          }
        }
      }
    }

    server.sendJson(res, {
      ok: true,
      data: neighbors,
      truncated: truncated || undefined,
      totalFiles: files.length,
    });
  });
}
