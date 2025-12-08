// packages/cli/src/commands/config.ts

import { Command } from "commander";
import chalk from "chalk";
import { getConfigValue, setConfigValue, loadConfig } from "../lib/config.js";

export function configCommands(parent: Command): void {
  const config = parent
    .command("config")
    .description("Manage configuration");

  config
    .command("set <key> <value>")
    .description("Set a config value")
    .action((key, value) => {
      try {
        setConfigValue(key, value);
        console.log(chalk.green(`Set ${key} = ${value}`));
      } catch (err) {
        console.error(chalk.red((err as Error).message));
        process.exit(1);
      }
    });

  config
    .command("get <key>")
    .description("Get a config value")
    .action((key) => {
      const value = getConfigValue(key);
      if (value === undefined) {
        console.log(chalk.dim("(not set)"));
      } else {
        console.log(value);
      }
    });

  config
    .command("list")
    .description("Show all config values")
    .action(() => {
      const cfg = loadConfig();
      if (Object.keys(cfg).length === 0) {
        console.log(chalk.dim("No configuration set"));
      } else {
        for (const [key, value] of Object.entries(cfg)) {
          console.log(`${key}: ${value}`);
        }
      }
    });

  config
    .command("path")
    .description("Show config file path")
    .action(() => {
      const { homedir } = require("node:os");
      const { join } = require("node:path");
      console.log(join(homedir(), ".petra", "config.json"));
    });
}
