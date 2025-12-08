// packages/cli/src/commands/daily.ts

import { Command } from "commander";
import chalk from "chalk";
import { createDailyNote, getDailyNote, listDailyNotes, parseDate, getDailyNotePath } from "../lib/daily.js";
import { PetraError } from "@petra/shared";

function handleError(err: unknown): never {
  if (err instanceof PetraError) {
    console.error(chalk.red(err.message));
    process.exit(1);
  }
  throw err;
}

export function dailyCommands(parent: Command): void {
  const daily = parent
    .command("daily")
    .description("Manage daily notes");

  daily
    .command("create")
    .description("Create today's daily note")
    .option("-d, --date <date>", "Date (YYYY-MM-DD, 'today', 'tomorrow', or 'yesterday')")
    .action((options) => {
      try {
        const date = options.date ? parseDate(options.date) : undefined;
        const { note, created } = createDailyNote(date);

        if (created) {
          console.log(chalk.green(`Created daily note: ${note.path}`));
        } else {
          console.log(chalk.yellow(`Daily note already exists: ${note.path}`));
        }
      } catch (err) {
        handleError(err);
      }
    });

  daily
    .command("open [date]")
    .description("Read a daily note (default: today)")
    .action((dateArg) => {
      try {
        const date = parseDate(dateArg);
        const note = getDailyNote(date);

        console.log(chalk.bold(note.title));
        console.log(chalk.dim("---"));
        console.log(note.content);
      } catch (err) {
        handleError(err);
      }
    });

  daily
    .command("list")
    .description("List recent daily notes")
    .option("-l, --limit <n>", "Number of notes to show (default: 7)", parseInt)
    .action((options) => {
      try {
        const limit = options.limit || 7;
        const notes = listDailyNotes(limit);

        if (notes.length === 0) {
          console.log(chalk.dim("No daily notes found"));
          return;
        }

        for (const note of notes) {
          // Extract date from path if available
          const dateMatch = note.path.match(/(\d{4}-\d{2}-\d{2})/);
          const dateStr = dateMatch ? dateMatch[1] : "";

          if (dateStr) {
            console.log(chalk.bold(`${dateStr} - ${note.title}`));
          } else {
            console.log(chalk.bold(note.title));
          }
          console.log(chalk.dim(`  ${note.path}`));
        }
      } catch (err) {
        handleError(err);
      }
    });
}
