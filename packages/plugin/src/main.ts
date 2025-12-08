import { Plugin, Notice } from "obsidian";
import { VERSION } from "@petra/shared";
import { PetraServer } from "./server";
import { getOrCreateToken } from "./auth";
import { registerNoteRoutes, registerDailyRoutes, registerSearchRoutes, registerTagRoutes, registerTemplateRoutes, registerLinkRoutes, registerGraphRoutes } from "./routes";

export default class PetraBridge extends Plugin {
  private server: PetraServer | null = null;

  async onload() {
    console.log(`Petra Bridge v${VERSION} loading...`);

    // Initialize server
    this.server = new PetraServer(this.app);

    // Set up auth
    const token = getOrCreateToken();
    this.server.setAuthToken(token);

    // Register routes (CRUD endpoints will be added in next task)
    this.registerRoutes();

    // Start server
    try {
      await this.server.start();
      new Notice("Petra Bridge started");
      console.log(`Petra Bridge v${VERSION} loaded and server running`);
    } catch (err) {
      console.error("Failed to start Petra server:", err);
      new Notice("Petra Bridge failed to start - check console");
    }
  }

  async onunload() {
    if (this.server) {
      await this.server.stop();
      console.log("Petra Bridge server stopped");
    }
    console.log("Petra Bridge unloaded");
  }

  private registerRoutes(): void {
    if (!this.server) return;

    // GET /vault - Return current vault info
    this.server.route("GET", "/vault", async (_req, res, _params, _body) => {
      const vault = this.app.vault;
      this.server!.sendJson(res, {
        ok: true,
        data: {
          name: vault.getName(),
          path: (vault.adapter as any).basePath || "",
        },
      });
    });

    // Register note routes
    registerNoteRoutes(this.server, this.app);

    // Register daily notes routes
    registerDailyRoutes(this.server, this.app);

    // Register search routes
    registerSearchRoutes(this.server, this.app);

    // Register tag routes
    registerTagRoutes(this.server, this.app);

    // Register template routes
    registerTemplateRoutes(this.server, this.app);

    // Register link routes
    registerLinkRoutes(this.server, this.app);

    // Register graph routes
    registerGraphRoutes(this.server, this.app);
  }
}
