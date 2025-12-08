// packages/plugin/src/settings.ts

import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import { randomBytes } from "crypto";
import { existsSync, writeFileSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { CONFIG_DIR, TOKEN_FILE } from "@petra/shared";
import type PetraBridge from "./main";

export class PetraSettingTab extends PluginSettingTab {
  plugin: PetraBridge;
  private showFullToken = false;

  constructor(app: App, plugin: PetraBridge) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private getTokenPath(): string {
    return join(homedir(), CONFIG_DIR, TOKEN_FILE);
  }

  private getToken(): string | null {
    const tokenPath = this.getTokenPath();
    if (!existsSync(tokenPath)) {
      return null;
    }
    try {
      return readFileSync(tokenPath, "utf-8").trim();
    } catch {
      return null;
    }
  }

  private maskToken(token: string): string {
    if (token.length <= 8) return "****";
    return token.slice(0, 4) + "..." + token.slice(-4);
  }

  private validateTokenFormat(token: string): { valid: boolean; message: string } {
    if (token.length < 40) {
      return { valid: false, message: `Token too short (${token.length} chars, expected ~43)` };
    }

    const base64urlRegex = /^[A-Za-z0-9_-]+$/;
    if (!base64urlRegex.test(token)) {
      return { valid: false, message: "Invalid characters (should be base64url)" };
    }

    if (token.length !== 43) {
      return { valid: false, message: `Length mismatch (${token.length} chars, expected 43)` };
    }

    return { valid: true, message: "Valid format" };
  }

  private regenerateToken(): string {
    return randomBytes(32).toString("base64url");
  }

  private saveToken(token: string): void {
    const configDir = join(homedir(), CONFIG_DIR);
    if (!existsSync(configDir)) {
      const { mkdirSync } = require("fs");
      mkdirSync(configDir, { recursive: true });
    }

    const tokenPath = this.getTokenPath();
    writeFileSync(tokenPath, token, { mode: 0o600 });
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Header
    containerEl.createEl("h2", { text: "Petra Bridge Settings" });

    // Bridge status
    const statusContainer = containerEl.createDiv({ cls: "petra-status" });
    const serverRunning = this.plugin.server !== null;

    new Setting(statusContainer)
      .setName("Bridge Status")
      .setDesc(serverRunning ? "✓ Server is running on port 27182" : "✗ Server is not running")
      .setClass(serverRunning ? "petra-status-ok" : "petra-status-error");

    // Token section
    containerEl.createEl("h3", { text: "Authentication Token" });

    const token = this.getToken();
    const tokenPath = this.getTokenPath();

    if (!token) {
      new Setting(containerEl)
        .setName("Token Status")
        .setDesc("⚠️ No token found. Click 'Generate Token' to create one.")
        .setClass("petra-status-warning");
    } else {
      const validation = this.validateTokenFormat(token);

      // Token display
      const tokenDisplay = new Setting(containerEl)
        .setName("Current Token")
        .setDesc(`Path: ${tokenPath}`)
        .addButton(button => button
          .setButtonText(this.showFullToken ? "Hide" : "Show Full")
          .onClick(() => {
            this.showFullToken = !this.showFullToken;
            this.display(); // Refresh display
          }))
        .addButton(button => button
          .setButtonText("Copy")
          .setTooltip("Copy token to clipboard")
          .onClick(() => {
            navigator.clipboard.writeText(token).then(() => {
              new Notice("Token copied to clipboard");
            }).catch(() => {
              new Notice("Failed to copy token", 3000);
            });
          }));

      // Show token value
      const tokenValueEl = tokenDisplay.descEl.createDiv({ cls: "petra-token-value" });
      tokenValueEl.createEl("code", {
        text: this.showFullToken ? token : this.maskToken(token),
        cls: "petra-token-code"
      });

      // Token validation status
      const validationSetting = new Setting(containerEl)
        .setName("Token Validation")
        .setDesc(validation.message)
        .setClass(validation.valid ? "petra-status-ok" : "petra-status-error");

      if (validation.valid) {
        validationSetting.descEl.prepend(createSpan({ text: "✓ ", cls: "petra-check" }));
      } else {
        validationSetting.descEl.prepend(createSpan({ text: "✗ ", cls: "petra-error" }));
      }

      // Token info
      new Setting(containerEl)
        .setName("Token Information")
        .setDesc(`Length: ${token.length} characters | Format: base64url (32 random bytes)`);
    }

    // Token actions
    containerEl.createEl("h3", { text: "Token Management" });

    // Regenerate token
    new Setting(containerEl)
      .setName("Generate New Token")
      .setDesc("Create a new secure authentication token. This will replace the existing token.")
      .addButton(button => button
        .setButtonText("Generate Token")
        .setWarning()
        .onClick(() => {
          const newToken = this.regenerateToken();
          this.saveToken(newToken);

          // Update server with new token
          if (this.plugin.server) {
            this.plugin.server.setAuthToken(newToken);
          }

          new Notice("✓ New token generated and applied");
          this.display(); // Refresh display
        }));

    // Manual token input
    let manualTokenValue = "";
    new Setting(containerEl)
      .setName("Set Token Manually")
      .setDesc("For advanced users: manually set a specific token value")
      .addText(text => text
        .setPlaceholder("Enter token (43 characters)")
        .onChange(value => {
          manualTokenValue = value;
        }))
      .addButton(button => button
        .setButtonText("Set Token")
        .onClick(() => {
          if (!manualTokenValue) {
            new Notice("Please enter a token value", 3000);
            return;
          }

          const validation = this.validateTokenFormat(manualTokenValue);
          if (!validation.valid) {
            new Notice(`Invalid token: ${validation.message}`, 5000);
            return;
          }

          this.saveToken(manualTokenValue);

          // Update server with new token
          if (this.plugin.server) {
            this.plugin.server.setAuthToken(manualTokenValue);
          }

          new Notice("✓ Token set and applied");
          this.display(); // Refresh display
        }));

    // Help section
    containerEl.createEl("h3", { text: "Help" });

    new Setting(containerEl)
      .setName("CLI Commands")
      .setDesc("You can also manage tokens using the Petra CLI")
      .setClass("petra-help");

    const helpEl = containerEl.createDiv({ cls: "petra-help-content" });
    helpEl.createEl("p", { text: "Available CLI commands:" });
    const codeBlock = helpEl.createEl("pre");
    codeBlock.createEl("code", { text: `petra bridge status          # Check bridge and token
petra bridge token show     # Display current token
petra bridge token validate # Validate token format
petra bridge token regenerate # Generate new token` });

    // Add CSS
    const style = containerEl.createEl("style");
    style.textContent = `
      .petra-status-ok { color: var(--text-success); }
      .petra-status-error { color: var(--text-error); }
      .petra-status-warning { color: var(--text-warning); }
      .petra-token-value { margin-top: 8px; }
      .petra-token-code {
        display: block;
        padding: 8px;
        background: var(--background-secondary);
        border-radius: 4px;
        font-family: var(--font-monospace);
        word-break: break-all;
      }
      .petra-help-content { margin-top: 8px; }
      .petra-help-content pre {
        background: var(--background-secondary);
        padding: 12px;
        border-radius: 4px;
        overflow-x: auto;
      }
      .petra-help-content code {
        font-family: var(--font-monospace);
        font-size: 0.9em;
      }
      .petra-check { color: var(--text-success); }
      .petra-error { color: var(--text-error); }
    `;
  }
}
