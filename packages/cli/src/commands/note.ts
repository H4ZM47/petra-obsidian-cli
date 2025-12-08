// packages/cli/src/commands/note.ts

import { Command } from "commander";
import chalk from "chalk";
import { createNote, readNote, updateNote, deleteNote, listNotes } from "../lib/notes.js";
import { PetraError } from "@petra/shared";

function handleError(err: unknown): never {
  if (err instanceof PetraError) {
    console.error(chalk.red(err.message));
    process.exit(1);
  }
  throw err;
}

export function noteCommands(parent: Command): void {
  const note = parent
    .command("note")
    .description("Manage notes");

  note
    .command("create <path>")
    .description("Create a new note")
    .option("-t, --title <title>", "Note title")
    .option("-c, --content <content>", "Initial content")
    .option("--tags <tags>", "Comma-separated tags")
    .action((path, options) => {
      try {
        const frontmatter: Record<string, unknown> = {};
        if (options.title) frontmatter.title = options.title;
        if (options.tags) frontmatter.tags = options.tags.split(",").map((t: string) => t.trim());

        const n = createNote(path, options.content || "", frontmatter);
        console.log(chalk.green(`Created note: ${n.path}`));
      } catch (err) {
        handleError(err);
      }
    });

  note
    .command("read <path>")
    .description("Read a note")
    .action((path) => {
      try {
        const n = readNote(path);
        console.log(chalk.bold(n.title));
        console.log(chalk.dim("---"));
        console.log(n.content);
      } catch (err) {
        handleError(err);
      }
    });

  note
    .command("update <path>")
    .description("Update a note")
    .option("-c, --content <content>", "New content (replaces existing)")
    .option("-a, --append <content>", "Append content")
    .action((path, options) => {
      try {
        const n = updateNote(path, {
          content: options.content,
          append: options.append,
        });
        console.log(chalk.green(`Updated note: ${n.path}`));
      } catch (err) {
        handleError(err);
      }
    });

  note
    .command("delete <path>")
    .description("Delete a note")
    .option("--trash", "Move to trash instead of permanent delete")
    .action((path, options) => {
      try {
        deleteNote(path, options.trash);
        console.log(chalk.green(`Deleted note: ${path}`));
      } catch (err) {
        handleError(err);
      }
    });

  note
    .command("list")
    .description("List notes")
    .option("-f, --folder <path>", "Filter by folder")
    .option("-l, --limit <n>", "Limit results", parseInt)
    .action((options) => {
      try {
        const notes = listNotes({
          folder: options.folder,
          limit: options.limit,
        });

        if (notes.length === 0) {
          console.log(chalk.dim("No notes found"));
          return;
        }

        for (const n of notes) {
          console.log(chalk.bold(n.title));
          console.log(chalk.dim(`  ${n.path}`));
          if (n.tags.length > 0) {
            console.log(chalk.cyan(`  #${n.tags.join(" #")}`));
          }
        }
      } catch (err) {
        handleError(err);
      }
    });
}
