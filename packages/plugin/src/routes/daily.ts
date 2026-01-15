// packages/plugin/src/routes/daily.ts

import { App, TFile } from "obsidian";
import { PetraServer } from "../server";
import type { Note, NoteInfo, NoteFrontmatter } from "@petra/shared";
import { parseFrontmatter } from "@petra/shared";

interface DailyConfig {
  format: string;
  folder: string;
  template?: string;
}

/** Get daily notes config from Obsidian settings */
function getDailyConfig(app: App): DailyConfig {
  // Try to read from daily-notes plugin config
  try {
    const configPath = ".obsidian/daily-notes.json";
    const configFile = app.vault.getAbstractFileByPath(configPath);
    if (configFile instanceof TFile) {
      // This is async but we need sync - use cached metadata instead
    }
  } catch {}

  // Return defaults
  return {
    format: "YYYY-MM-DD",
    folder: "",
  };
}

/** Format date using pattern */
function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  let result = format;
  result = result.replace(/YYYY/g, String(year));
  result = result.replace(/MM/g, month);
  result = result.replace(/DD/g, day);
  result = result.replace(/dddd/g, dayNames[date.getDay()]);
  result = result.replace(/ddd/g, dayNamesShort[date.getDay()]);

  return result;
}

/** Parse date string */
function parseDate(dateStr: string): Date | null {
  if (dateStr === "today") return new Date();
  if (dateStr === "tomorrow") {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (dateStr === "yesterday") {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }

  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }

  return null;
}

/** Convert file to Note */
async function fileToNote(app: App, file: TFile): Promise<Note> {
  const raw = await app.vault.read(file);
  const { data: frontmatter, content: body } = parseFrontmatter(raw);

  return {
    path: file.path.replace(/\.md$/, ""),
    title: (frontmatter.title as string) || file.basename,
    content: body,
    frontmatter: frontmatter as NoteFrontmatter,
    raw,
  };
}

/** Register daily notes routes */
export function registerDailyRoutes(server: PetraServer, app: App): void {

  // POST /daily - Create daily note
  server.route("POST", "/daily", async (req, res, params, body) => {
    const { date: dateStr = "today" } = body as { date?: string };

    const date = parseDate(dateStr);
    if (!date) {
      server.sendError(res, 400, "INVALID_PATH", `Invalid date: ${dateStr}`);
      return;
    }

    const config = getDailyConfig(app);
    const filename = formatDate(date, config.format);
    const notePath = config.folder ? `${config.folder}/${filename}.md` : `${filename}.md`;

    // Check if exists
    const existing = app.vault.getAbstractFileByPath(notePath);
    if (existing instanceof TFile) {
      const note = await fileToNote(app, existing);
      server.sendJson(res, { ok: true, data: { note, created: false } });
      return;
    }

    // Create folder if needed
    if (config.folder) {
      const folder = app.vault.getAbstractFileByPath(config.folder);
      if (!folder) {
        await app.vault.createFolder(config.folder);
      }
    }

    // Create daily note
    const content = `---\ncreated: ${new Date().toISOString()}\n---\n`;
    const file = await app.vault.create(notePath, content);
    const note = await fileToNote(app, file);

    server.sendJson(res, { ok: true, data: { note, created: true } });
  });

  // GET /daily/:date - Get daily note
  server.route("GET", "/daily/:date", async (req, res, params, body) => {
    const date = parseDate(params.date);
    if (!date) {
      server.sendError(res, 400, "INVALID_PATH", `Invalid date: ${params.date}`);
      return;
    }

    const config = getDailyConfig(app);
    const filename = formatDate(date, config.format);
    const notePath = config.folder ? `${config.folder}/${filename}.md` : `${filename}.md`;

    const file = app.vault.getAbstractFileByPath(notePath);
    if (!(file instanceof TFile)) {
      server.sendError(res, 404, "NOT_FOUND", `Daily note not found for ${params.date}`);
      return;
    }

    const note = await fileToNote(app, file);
    server.sendJson(res, { ok: true, data: note });
  });

  // GET /daily - List recent daily notes
  server.route("GET", "/daily", async (req, res, params, body) => {
    const url = new URL(req.url || "/", "http://localhost");
    const limit = parseInt(url.searchParams.get("limit") || "7");

    const config = getDailyConfig(app);
    const files = app.vault.getMarkdownFiles();

    // Filter to daily notes by pattern matching
    const dailyPattern = /^\d{4}-\d{2}-\d{2}$/;
    const dailyNotes: Array<{ file: TFile; date: Date }> = [];

    for (const file of files) {
      // Check if in daily folder
      if (config.folder && !file.path.startsWith(config.folder)) continue;

      // Check filename matches date pattern
      if (dailyPattern.test(file.basename)) {
        const [year, month, day] = file.basename.split("-").map(Number);
        dailyNotes.push({
          file,
          date: new Date(year, month - 1, day),
        });
      }
    }

    // Sort by date descending
    dailyNotes.sort((a, b) => b.date.getTime() - a.date.getTime());

    // Get note info
    const notes: NoteInfo[] = [];
    for (const { file } of dailyNotes.slice(0, limit)) {
      const content = await app.vault.read(file);
      const { data: frontmatter } = parseFrontmatter(content);

      notes.push({
        path: file.path.replace(/\.md$/, ""),
        title: (frontmatter.title as string) || file.basename,
        tags: (frontmatter.tags as string[]) || [],
        created: frontmatter.created as string,
        modified: frontmatter.modified as string,
      });
    }

    server.sendJson(res, { ok: true, data: notes });
  });
}
