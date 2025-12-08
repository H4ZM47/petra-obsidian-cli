// packages/cli/src/commands/note.ts

import { Command } from "commander";
import chalk from "chalk";
import { createNote, readNote, updateNote, deleteNote, listNotes, moveNote, searchNotes } from "../lib/notes.js";
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
    .command("move <from> <to>")
    .description("Move/rename a note")
    .option("--force", "Overwrite destination if it exists")
    .action((from, to, options) => {
      try {
        console.log(chalk.yellow("Warning: Links to this note will not be updated. Use Obsidian with petra-bridge for link-aware moves."));
        const n = moveNote(from, to, options.force);
        console.log(chalk.green(`Moved note: ${from} -> ${n.path}`));
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

  note
    .command("search <query>")
    .description("Search notes")
    .option("-f, --folder <path>", "Search within specific folder")
    .option("-l, --limit <n>", "Limit results (default: 20)", parseInt, 20)
    .option("-i, --case-sensitive", "Case-sensitive search")
    .option("--json", "Output as JSON")
    .action((query, options) => {
      try {
        const results = searchNotes(query, {
          folder: options.folder,
          limit: options.limit,
          caseSensitive: options.caseSensitive,
        });

        if (options.json) {
          console.log(JSON.stringify(results, null, 2));
          return;
        }

        if (results.length === 0) {
          console.log(chalk.dim(`No results found for "${query}"`));
          return;
        }

        console.log(chalk.green(`Found ${results.length} note(s) matching "${query}":\n`));

        for (const result of results) {
          console.log(chalk.bold(result.note.title));
          console.log(chalk.dim(`  ${result.note.path}`));

          if (result.note.tags.length > 0) {
            console.log(chalk.cyan(`  #${result.note.tags.join(" #")}`));
          }

          console.log(chalk.yellow(`  ${result.matches.length} match(es):`));

          // Show first 5 matches
          const displayMatches = result.matches.slice(0, 5);
          for (const match of displayMatches) {
            if (match.line === 0) {
              console.log(chalk.dim(`    ${match.text}`));
            } else {
              // Highlight the query in the match text
              const highlightedText = options.caseSensitive
                ? match.text.replace(
                    new RegExp(`(${query})`, "g"),
                    chalk.inverse("$1")
                  )
                : match.text.replace(
                    new RegExp(`(${query})`, "gi"),
                    chalk.inverse("$1")
                  );
              console.log(chalk.dim(`    Line ${match.line}: `) + highlightedText);
            }
          }

          if (result.matches.length > 5) {
            console.log(chalk.dim(`    ... and ${result.matches.length - 5} more match(es)`));
          }

          console.log(); // Empty line between results
        }
      } catch (err) {
        handleError(err);
      }
    });
}
