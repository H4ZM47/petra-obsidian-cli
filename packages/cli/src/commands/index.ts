// packages/cli/src/commands/index.ts

import { Command } from "commander";

export function registerCommands(program: Command): void {
  // Note commands
  const note = program
    .command("note")
    .description("Manage notes");

  note
    .command("create <path>")
    .description("Create a new note")
    .option("-t, --template <name>", "Use a template")
    .option("-c, --content <content>", "Initial content")
    .action(async (path, options) => {
      console.log("note create", path, options);
    });

  note
    .command("read <path>")
    .description("Read a note")
    .action(async (path) => {
      console.log("note read", path);
    });

  note
    .command("update <path>")
    .description("Update a note")
    .option("-c, --content <content>", "New content")
    .option("-a, --append <content>", "Append content")
    .action(async (path, options) => {
      console.log("note update", path, options);
    });

  note
    .command("delete <path>")
    .description("Delete a note")
    .option("--trash", "Move to trash instead of permanent delete")
    .action(async (path, options) => {
      console.log("note delete", path, options);
    });

  note
    .command("list")
    .description("List notes")
    .option("-f, --folder <path>", "Filter by folder")
    .option("-l, --limit <n>", "Limit results", parseInt)
    .action(async (options) => {
      console.log("note list", options);
    });

  // Vault commands
  const vault = program
    .command("vault")
    .description("Manage vaults");

  vault
    .command("list")
    .description("List available vaults")
    .action(async () => {
      console.log("vault list");
    });

  vault
    .command("switch <path>")
    .description("Switch active vault")
    .action(async (path) => {
      console.log("vault switch", path);
    });

  vault
    .command("info")
    .description("Show current vault info")
    .action(async () => {
      console.log("vault info");
    });

  // Config commands
  const config = program
    .command("config")
    .description("Manage configuration");

  config
    .command("set <key> <value>")
    .description("Set a config value")
    .action(async (key, value) => {
      console.log("config set", key, value);
    });

  config
    .command("get <key>")
    .description("Get a config value")
    .action(async (key) => {
      console.log("config get", key);
    });
}
