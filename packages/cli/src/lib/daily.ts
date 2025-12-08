// packages/cli/src/lib/daily.ts

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { requireVault } from "./vault.js";
import { createNote, readNote } from "./notes.js";
import type { Note, NoteInfo } from "@petra/shared";
import { invalidPath } from "@petra/shared";

/** Daily notes configuration from Obsidian */
export interface DailyConfig {
  /** Date format string (e.g., "YYYY-MM-DD") */
  format: string;
  /** Folder for daily notes (empty string means root) */
  folder: string;
  /** Template file path (optional) */
  template?: string;
}

/** Get daily notes configuration from Obsidian settings */
export function getDailyConfig(): DailyConfig {
  const vault = requireVault();
  const configPath = join(vault.path, ".obsidian", "daily-notes.json");

  // Return defaults if config file doesn't exist
  if (!existsSync(configPath)) {
    return {
      format: "YYYY-MM-DD",
      folder: "",
    };
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const config = JSON.parse(content);

    return {
      format: config.format || "YYYY-MM-DD",
      folder: config.folder || "",
      template: config.template,
    };
  } catch {
    // If config is malformed, return defaults
    return {
      format: "YYYY-MM-DD",
      folder: "",
    };
  }
}

/** Format a date using the configured format string */
export function formatDate(date: Date, format: string): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayNamesShort = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayOfWeek = date.getDay();

  let formatted = format;
  formatted = formatted.replace(/YYYY/g, String(year));
  formatted = formatted.replace(/MM/g, month);
  formatted = formatted.replace(/DD/g, day);
  formatted = formatted.replace(/dddd/g, dayNames[dayOfWeek]);
  formatted = formatted.replace(/ddd/g, dayNamesShort[dayOfWeek]);

  return formatted;
}

/** Parse a date string or special value ("today", "tomorrow", "yesterday") */
export function parseDate(dateStr?: string): Date {
  if (!dateStr || dateStr === "today") {
    return new Date();
  }

  if (dateStr === "tomorrow") {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return date;
  }

  if (dateStr === "yesterday") {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
  }

  // Try to parse YYYY-MM-DD format
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw invalidPath(`Invalid date format: ${dateStr}. Use YYYY-MM-DD, "today", "tomorrow", or "yesterday"`);
  }

  const [, year, month, day] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  // Verify the date is valid
  if (isNaN(date.getTime())) {
    throw invalidPath(`Invalid date: ${dateStr}`);
  }

  return date;
}

/** Get the path for a daily note */
export function getDailyNotePath(date?: Date): string {
  const config = getDailyConfig();
  const actualDate = date || new Date();
  const filename = formatDate(actualDate, config.format);

  if (config.folder) {
    return join(config.folder, filename);
  }

  return filename;
}

/** Create a daily note (returns existing note if already exists) */
export function createDailyNote(date?: Date): { note: Note; created: boolean } {
  const notePath = getDailyNotePath(date);
  const vault = requireVault();
  const fullPath = join(vault.path, notePath + ".md");

  // Check if note already exists
  if (existsSync(fullPath)) {
    const note = readNote(notePath);
    return { note, created: false };
  }

  // Create new daily note
  const note = createNote(notePath);
  return { note, created: true };
}

/** Read a daily note */
export function getDailyNote(date?: Date): Note {
  const notePath = getDailyNotePath(date);
  return readNote(notePath);
}

/** List recent daily notes */
export function listDailyNotes(limit: number = 7): NoteInfo[] {
  const vault = requireVault();
  const config = getDailyConfig();
  const dailyDir = config.folder
    ? join(vault.path, config.folder)
    : vault.path;

  if (!existsSync(dailyDir)) {
    return [];
  }

  const notes: Array<{ note: NoteInfo; date: Date }> = [];

  try {
    const entries = readdirSync(dailyDir);

    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;

      const fullPath = join(dailyDir, entry);
      const stat = statSync(fullPath);

      // Skip directories
      if (stat.isDirectory()) continue;

      const filename = basename(entry, ".md");

      // Try to parse the filename as a date using the configured format
      // For simplicity, we'll check if the file matches common date patterns
      if (filename.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const notePath = config.folder
          ? join(config.folder, filename)
          : filename;

        try {
          const note = readNote(notePath);

          // Parse date from filename
          const dateParts = filename.match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (dateParts) {
            const [, year, month, day] = dateParts;
            const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

            notes.push({
              note: {
                path: note.path,
                title: note.title,
                tags: note.frontmatter.tags || [],
                created: note.frontmatter.created,
                modified: note.frontmatter.modified,
              },
              date,
            });
          }
        } catch {
          // Skip files that can't be read
          continue;
        }
      }
    }
  } catch {
    return [];
  }

  // Sort by date (most recent first)
  notes.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Apply limit and return note info only
  return notes.slice(0, limit).map(n => n.note);
}
