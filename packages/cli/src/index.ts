import { Command } from "commander";
import { VERSION } from "@petra/shared";
import { registerCommands } from "./commands/index.js";
import { setGlobalOptions } from "./lib/output.js";

const program = new Command();

program
  .name("petra")
  .description("CLI for Obsidian vaults")
  .version(VERSION)
  .option("-j, --json", "Output as JSON")
  .option("-q, --quiet", "Suppress non-error output")
  .option("-v, --vault <path>", "Override vault path")
  .hook("preAction", (thisCommand) => {
    const opts = thisCommand.opts();
    setGlobalOptions({
      json: opts.json,
      quiet: opts.quiet,
      vault: opts.vault,
    });
  });

registerCommands(program);

program.parse();
