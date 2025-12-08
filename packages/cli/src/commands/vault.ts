// packages/cli/src/commands/vault.ts

import { Command } from "commander";
import chalk from "chalk";
import { getObsidianVaults, getActiveVault, switchVault } from "../lib/vault.js";
import { PetraError } from "@petra/shared";

export function vaultCommands(parent: Command): void {
  const vault = parent
    .command("vault")
    .description("Manage vaults");

  vault
    .command("list")
    .description("List available vaults")
    .action(() => {
      const vaults = getObsidianVaults();

      if (vaults.length === 0) {
        console.log(chalk.dim("No Obsidian vaults found"));
        console.log(chalk.dim("Use 'petra vault switch <path>' to set a vault manually"));
        return;
      }

      for (const v of vaults) {
        const marker = v.active ? chalk.green("* ") : "  ";
        console.log(`${marker}${chalk.bold(v.name)}`);
        console.log(`   ${chalk.dim(v.path)}`);
      }
    });

  vault
    .command("switch <path>")
    .description("Switch active vault")
    .action((path) => {
      try {
        const v = switchVault(path);
        console.log(chalk.green(`Switched to vault: ${v.name}`));
        console.log(chalk.dim(v.path));
      } catch (err) {
        if (err instanceof PetraError) {
          console.error(chalk.red(err.message));
          process.exit(1);
        }
        throw err;
      }
    });

  vault
    .command("info")
    .description("Show current vault info")
    .action(() => {
      const v = getActiveVault();

      if (!v) {
        console.log(chalk.yellow("No vault configured"));
        console.log(chalk.dim("Use 'petra vault switch <path>' to set a vault"));
        return;
      }

      console.log(chalk.bold("Active Vault"));
      console.log(`  Name: ${v.name}`);
      console.log(`  Path: ${v.path}`);
      console.log(`  ID:   ${v.id}`);
    });
}
