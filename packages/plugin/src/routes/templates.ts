// packages/plugin/src/routes/templates.ts

import { App, TFile, TFolder } from "obsidian";
import { PetraServer } from "../server";
import type { Note } from "@petra/shared";

interface TemplateInfo {
  name: string;
  path: string;
}

/** Get templates folder from Obsidian settings */
function getTemplatesFolder(app: App): string {
  // Default Obsidian templates folder
  // Could also check core-plugins/templates settings
  const possibleFolders = ["Templates", "templates", "_templates"];

  for (const folder of possibleFolders) {
    if (app.vault.getAbstractFileByPath(folder) instanceof TFolder) {
      return folder;
    }
  }

  return "Templates"; // Default
}

/** Simple template variable replacement */
function processTemplate(content: string, variables: Record<string, string>): string {
  let processed = content;

  // Replace {{variable}} patterns
  for (const [key, value] of Object.entries(variables)) {
    const pattern = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    processed = processed.replace(pattern, value);
  }

  // Built-in variables
  const now = new Date();
  processed = processed.replace(/\{\{\s*date\s*\}\}/g, now.toISOString().split("T")[0]);
  processed = processed.replace(/\{\{\s*time\s*\}\}/g, now.toTimeString().split(" ")[0]);
  processed = processed.replace(/\{\{\s*datetime\s*\}\}/g, now.toISOString());

  return processed;
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

/** Register template routes */
export function registerTemplateRoutes(server: PetraServer, app: App): void {

  // GET /templates - List available templates
  server.route("GET", "/templates", async (_req, res, _params, _body) => {
    const templatesFolder = getTemplatesFolder(app);
    const folder = app.vault.getAbstractFileByPath(templatesFolder);

    if (!(folder instanceof TFolder)) {
      server.sendJson(res, { ok: true, data: [] });
      return;
    }

    const templates: TemplateInfo[] = [];

    function scanFolder(f: TFolder, prefix: string = "") {
      for (const child of f.children) {
        if (child instanceof TFile && child.extension === "md") {
          templates.push({
            name: prefix + child.basename,
            path: child.path,
          });
        } else if (child instanceof TFolder) {
          scanFolder(child, prefix + child.name + "/");
        }
      }
    }

    scanFolder(folder);
    templates.sort((a, b) => a.name.localeCompare(b.name));

    server.sendJson(res, { ok: true, data: templates });
  });

  // POST /templates/:name/run - Execute a template
  server.route("POST", "/templates/:name/run", async (_req, res, params, body) => {
    const { destination, variables = {} } = body as {
      destination: string;
      variables?: Record<string, string>;
    };

    if (!destination) {
      server.sendError(res, 400, "INVALID_PATH", "Destination path is required");
      return;
    }

    // Find template
    const templatesFolder = getTemplatesFolder(app);
    const templatePath = `${templatesFolder}/${params.name}.md`;
    const templateFile = app.vault.getAbstractFileByPath(templatePath);

    if (!(templateFile instanceof TFile)) {
      server.sendError(res, 404, "NOT_FOUND", `Template not found: ${params.name}`);
      return;
    }

    // Read and process template
    const templateContent = await app.vault.read(templateFile);
    const processedContent = processTemplate(templateContent, {
      title: destination.split("/").pop()?.replace(".md", "") || "",
      ...variables,
    });

    // Create destination
    const destPath = destination.endsWith(".md") ? destination : destination + ".md";

    // Check if exists
    if (app.vault.getAbstractFileByPath(destPath)) {
      server.sendError(res, 409, "ALREADY_EXISTS", `Note already exists: ${destination}`);
      return;
    }

    // Create parent folder if needed
    const parentPath = destPath.split("/").slice(0, -1).join("/");
    if (parentPath && !app.vault.getAbstractFileByPath(parentPath)) {
      await app.vault.createFolder(parentPath);
    }

    // Create the note
    const newFile = await app.vault.create(destPath, processedContent);

    // Return the created note
    const { frontmatter, body: noteBody } = parseFrontmatter(processedContent);
    const note: Note = {
      path: newFile.path.replace(/\.md$/, ""),
      title: (frontmatter.title as string) || newFile.basename,
      content: noteBody,
      frontmatter,
      raw: processedContent,
    };

    server.sendJson(res, { ok: true, data: note });
  });
}
