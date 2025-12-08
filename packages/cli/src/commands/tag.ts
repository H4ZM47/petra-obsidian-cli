// packages/cli/src/commands/tag.ts

import { Command } from "commander";
import chalk from "chalk";
import { getAllTags, findNotesByTag } from "../lib/tags.js";
import { PetraError } from "@petra/shared";

function handleError(err: unknown): never {
  if (err instanceof PetraError) {
    console.error(chalk.red(err.message));
    process.exit(1);
  }
  throw err;
}

export function tagCommands(parent: Command): void {
  const tag = parent
    .command("tag")
    .description("Manage and search tags");

  tag
    .command("list")
    .description("List all tags with occurrence counts")
    .action(() => {
      try {
        const tagCounts = getAllTags();

        if (tagCounts.size === 0) {
          console.log(chalk.dim("No tags found"));
          return;
        }

        // Convert to array and sort by count (descending)
        const sorted = Array.from(tagCounts.entries()).sort(
          (a, b) => b[1] - a[1]
        );

        for (const [tagName, count] of sorted) {
          console.log(chalk.cyan(`#${tagName}`) + chalk.dim(` (${count})`));
        }
      } catch (err) {
        handleError(err);
      }
    });

  tag
    .command("search <tag>")
    .description("Find notes containing a tag")
    .option("-e, --exact", "Require exact tag match")
    .option("-l, --limit <n>", "Limit number of results", parseInt)
    .action((tagArg, options) => {
      try {
        // Remove leading # if provided
        const searchTag = tagArg.startsWith("#") ? tagArg.slice(1) : tagArg;

        const notes = findNotesByTag(searchTag, {
          exact: options.exact,
          limit: options.limit,
        });

        if (notes.length === 0) {
          console.log(
            chalk.dim(
              `No notes found with tag "${searchTag}"${
                options.exact ? " (exact match)" : ""
              }`
            )
          );
          return;
        }

        for (const note of notes) {
          console.log(chalk.bold(note.title));
          console.log(chalk.dim(`  ${note.path}`));
          if (note.allTags.length > 0) {
            console.log(chalk.cyan(`  #${note.allTags.join(" #")}`));
          }
        }
      } catch (err) {
        handleError(err);
      }
    });
}
