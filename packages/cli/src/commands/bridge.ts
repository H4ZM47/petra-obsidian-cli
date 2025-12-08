// packages/cli/src/commands/bridge.ts

import { Command } from "commander";
import chalk from "chalk";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { CONFIG_DIR, TOKEN_FILE } from "@petra/shared";
import { checkBridgeAvailable } from "../lib/bridge.js";
import { success, error as outputError } from "../lib/output.js";

const TOKEN_LENGTH = 43; // base64url encoding of 32 bytes

function getTokenPath(): string {
  return join(homedir(), CONFIG_DIR, TOKEN_FILE);
}

function getToken(): string | null {
  const tokenPath = getTokenPath();
  if (!existsSync(tokenPath)) {
    return null;
  }
  try {
    return readFileSync(tokenPath, "utf-8").trim();
  } catch {
    return null;
  }
}

function maskToken(token: string): string {
  if (token.length <= 8) return "****";
  return token.slice(0, 4) + "..." + token.slice(-4);
}

function validateTokenFormat(token: string): { valid: boolean; message: string } {
  // Token should be base64url encoded (32 bytes = 43 chars)
  if (token.length < 40) {
    return { valid: false, message: `Token too short (${token.length} chars, expected ~43)` };
  }

  // base64url uses: A-Z, a-z, 0-9, -, _ (no + or /)
  const base64urlRegex = /^[A-Za-z0-9_-]+$/;
  if (!base64urlRegex.test(token)) {
    return { valid: false, message: "Token contains invalid characters (should be base64url)" };
  }

  if (token.length !== TOKEN_LENGTH) {
    return { valid: false, message: `Token length mismatch (${token.length} chars, expected ${TOKEN_LENGTH})` };
  }

  return { valid: true, message: "Token format is valid" };
}

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

function saveToken(token: string): void {
  const configDir = join(homedir(), CONFIG_DIR);
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const tokenPath = getTokenPath();
  writeFileSync(tokenPath, token, { mode: 0o600 });
}

export function bridgeCommands(parent: Command): void {
  const bridge = parent
    .command("bridge")
    .description("Manage Obsidian bridge connection");

  bridge
    .command("status")
    .description("Check if bridge is running and auth is valid")
    .action(async () => {
      try {
        const isAvailable = await checkBridgeAvailable();

        if (!isAvailable) {
          console.log(chalk.red("✗ Bridge is not available"));
          console.log(chalk.dim("\nTroubleshooting:"));
          console.log(chalk.dim("  1. Make sure Obsidian is running"));
          console.log(chalk.dim("  2. Ensure petra-bridge plugin is installed and enabled"));
          console.log(chalk.dim("  3. Check that the plugin started successfully"));
          process.exit(1);
        }

        const token = getToken();
        if (!token) {
          console.log(chalk.yellow("⚠ Bridge is running but no token found"));
          console.log(chalk.dim("\nRun: petra bridge token regenerate"));
          process.exit(1);
        }

        const validation = validateTokenFormat(token);
        if (!validation.valid) {
          console.log(chalk.red("✗ Bridge is running but token is invalid"));
          console.log(chalk.dim(`  ${validation.message}`));
          console.log(chalk.dim("\nRun: petra bridge token regenerate"));
          process.exit(1);
        }

        console.log(chalk.green("✓ Bridge is running"));
        console.log(chalk.green("✓ Token exists and is valid format"));
        console.log(chalk.dim(`\nToken: ${maskToken(token)}`));
        console.log(chalk.dim(`Path: ${getTokenPath()}`));
      } catch (err) {
        if (err instanceof Error) {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });

  const token = bridge
    .command("token")
    .description("Manage authentication token");

  token
    .command("show")
    .description("Display current token")
    .option("--full", "Show full token (default: masked)")
    .action((options) => {
      try {
        const currentToken = getToken();

        if (!currentToken) {
          console.log(chalk.red("No token found"));
          console.log(chalk.dim(`\nExpected location: ${getTokenPath()}`));
          console.log(chalk.dim("Run: petra bridge token regenerate"));
          process.exit(1);
        }

        console.log(chalk.bold("Token:"));
        if (options.full) {
          console.log(chalk.cyan(currentToken));
        } else {
          console.log(chalk.cyan(maskToken(currentToken)));
          console.log(chalk.dim("\nUse --full to show complete token"));
        }

        console.log(chalk.dim(`\nPath: ${getTokenPath()}`));
        console.log(chalk.dim(`Length: ${currentToken.length} characters`));

        const validation = validateTokenFormat(currentToken);
        if (validation.valid) {
          console.log(chalk.green(`✓ ${validation.message}`));
        } else {
          console.log(chalk.yellow(`⚠ ${validation.message}`));
        }
      } catch (err) {
        if (err instanceof Error) {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });

  token
    .command("validate")
    .description("Check if current token is valid format")
    .action(() => {
      try {
        const currentToken = getToken();

        if (!currentToken) {
          console.log(chalk.red("✗ No token found"));
          console.log(chalk.dim(`\nExpected location: ${getTokenPath()}`));
          process.exit(1);
        }

        const validation = validateTokenFormat(currentToken);

        if (validation.valid) {
          console.log(chalk.green(`✓ ${validation.message}`));
          console.log(chalk.dim(`\nToken: ${maskToken(currentToken)}`));
          console.log(chalk.dim(`Length: ${currentToken.length} characters`));
        } else {
          console.log(chalk.red(`✗ ${validation.message}`));
          console.log(chalk.dim(`\nCurrent token: ${maskToken(currentToken)}`));
          console.log(chalk.dim(`Length: ${currentToken.length} characters`));
          console.log(chalk.dim("\nRun: petra bridge token regenerate"));
          process.exit(1);
        }
      } catch (err) {
        if (err instanceof Error) {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });

  token
    .command("regenerate")
    .description("Generate a new token")
    .option("--force", "Skip confirmation prompt")
    .action((options) => {
      try {
        const currentToken = getToken();

        if (!options.force && currentToken) {
          console.log(chalk.yellow("⚠ This will replace your existing token"));
          console.log(chalk.dim(`Current: ${maskToken(currentToken)}`));
          console.log(chalk.dim("\nYou'll need to restart Obsidian for the plugin to use the new token."));
          console.log(chalk.dim("Use --force to skip this confirmation."));
          process.exit(1);
        }

        const newToken = generateToken();
        saveToken(newToken);

        console.log(chalk.green("✓ Generated new token"));
        console.log(chalk.cyan(`\nNew token: ${newToken}`));
        console.log(chalk.dim(`Saved to: ${getTokenPath()}`));
        console.log(chalk.dim("\n⚠ Important: Restart Obsidian for the plugin to use the new token"));
      } catch (err) {
        if (err instanceof Error) {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });

  token
    .command("set <token>")
    .description("Manually set token (for testing/advanced use)")
    .action((tokenValue) => {
      try {
        const validation = validateTokenFormat(tokenValue);

        if (!validation.valid) {
          console.log(chalk.red(`✗ Invalid token: ${validation.message}`));
          console.log(chalk.dim("\nToken must be:"));
          console.log(chalk.dim("  - 43 characters long"));
          console.log(chalk.dim("  - base64url encoded (A-Z, a-z, 0-9, -, _)"));
          console.log(chalk.dim("\nGenerate a valid token with: petra bridge token regenerate"));
          process.exit(1);
        }

        saveToken(tokenValue);
        success("Token saved successfully");
        console.log(chalk.dim(`Path: ${getTokenPath()}`));
        console.log(chalk.dim("\n⚠ Remember to restart Obsidian for the plugin to use this token"));
      } catch (err) {
        if (err instanceof Error) {
          outputError(err.message);
        }
        process.exit(1);
      }
    });
}
