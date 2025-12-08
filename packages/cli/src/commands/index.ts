// packages/cli/src/commands/index.ts

import { Command } from "commander";
import { configCommands } from "./config.js";
import { vaultCommands } from "./vault.js";
import { noteCommands } from "./note.js";

export function registerCommands(program: Command): void {
  noteCommands(program);
  vaultCommands(program);
  configCommands(program);
}
