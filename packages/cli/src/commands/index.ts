// packages/cli/src/commands/index.ts

import { Command } from "commander";
import { configCommands } from "./config.js";
import { vaultCommands } from "./vault.js";
import { noteCommands } from "./note.js";
import { tagCommands } from "./tag.js";
import { dailyCommands } from "./daily.js";
import { templateCommands } from "./template.js";
import { graphCommands } from "./graph.js";

export function registerCommands(program: Command): void {
  noteCommands(program);
  dailyCommands(program);
  vaultCommands(program);
  configCommands(program);
  tagCommands(program);
  templateCommands(program);
  graphCommands(program);
}
