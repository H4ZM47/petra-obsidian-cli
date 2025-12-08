#!/usr/bin/env node

import { Command } from "commander";
import { VERSION } from "@petra/shared";
import { registerCommands } from "./commands/index.js";

const program = new Command();

program
  .name("petra")
  .description("CLI for Obsidian vaults")
  .version(VERSION)
  .option("-j, --json", "Output as JSON")
  .option("-q, --quiet", "Suppress non-error output")
  .option("-v, --vault <path>", "Override vault path");

registerCommands(program);

program.parse();
