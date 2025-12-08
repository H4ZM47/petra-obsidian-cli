// packages/cli/src/commands/template.ts

import { Command } from "commander";
import chalk from "chalk";
import { requireBridge } from "../lib/bridge.js";
import type { Note } from "@petra/shared";

export function templateCommands(parent: Command): void {
  const template = parent
    .command("template")
    .description("Template operations (requires bridge)");

  template
    .command("list")
    .description("List available templates")
    .action(async () => {
      try {
        const client = await requireBridge();
        const result = await client.get<Array<{ name: string; path: string }>>("/templates");

        if (!result.ok) {
          console.error(chalk.red(result.error.message));
          process.exit(1);
        }

        const templates = result.data;

        if (templates.length === 0) {
          console.log(chalk.dim("No templates found"));
          console.log(chalk.dim("Create templates in a 'Templates' folder in your vault"));
          return;
        }

        console.log(chalk.green(`${templates.length} template(s) available:\n`));

        for (const t of templates) {
          console.log(`  ${chalk.bold(t.name)}`);
          console.log(chalk.dim(`    ${t.path}`));
        }
      } catch (err) {
        if (err instanceof Error) {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });

  template
    .command("run <name> <destination>")
    .description("Create a note from a template")
    .option("-v, --var <key=value...>", "Template variables (can be repeated)")
    .action(async (name, destination, options) => {
      try {
        const client = await requireBridge();

        // Parse variables
        const variables: Record<string, string> = {};
        if (options.var) {
          const vars = Array.isArray(options.var) ? options.var : [options.var];
          for (const v of vars) {
            const [key, ...valueParts] = v.split("=");
            if (key && valueParts.length > 0) {
              variables[key] = valueParts.join("=");
            }
          }
        }

        const result = await client.post<Note>(`/templates/${encodeURIComponent(name)}/run`, {
          destination,
          variables,
        });

        if (!result.ok) {
          console.error(chalk.red(result.error.message));
          process.exit(1);
        }

        console.log(chalk.green(`Created note from template: ${result.data.path}`));
      } catch (err) {
        if (err instanceof Error) {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });
}
