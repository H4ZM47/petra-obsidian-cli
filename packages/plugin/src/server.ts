// packages/plugin/src/server.ts

import { App } from "obsidian";
import { DEFAULT_PORT } from "@petra/shared";
import type { ApiResponse, ApiError } from "@petra/shared";

// Node's http is available in Obsidian desktop
import * as http from "http";
import { timingSafeEqual } from "crypto";

/** Maximum request body size (10MB) */
const MAX_BODY_SIZE = 10 * 1024 * 1024;

export type RouteHandler = (
  req: http.IncomingMessage,
  res: http.ServerResponse,
  params: Record<string, string>,
  body: unknown
) => Promise<void>;

export interface Route {
  method: string;
  pattern: RegExp;
  paramNames: string[];
  handler: RouteHandler;
}

export class PetraServer {
  private server: http.Server | null = null;
  private routes: Route[] = [];
  private authToken: string | null = null;

  constructor(public readonly app: App) {}

  /** Set the auth token for request validation */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /** Register a route */
  route(method: string, path: string, handler: RouteHandler): void {
    // Convert path pattern like /notes/:path to regex
    const paramNames: string[] = [];
    const pattern = path.replace(/:(\w+)/g, (_, name) => {
      paramNames.push(name);
      return "([^/]+)";
    });

    this.routes.push({
      method: method.toUpperCase(),
      pattern: new RegExp(`^${pattern}$`),
      paramNames,
      handler,
    });
  }

  /** Start the HTTP server */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        // Set CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

        // Handle preflight
        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        try {
          await this.handleRequest(req, res);
        } catch (err) {
          this.sendError(res, 500, "INTERNAL_ERROR", String(err));
        }
      });

      this.server.on("error", reject);
      this.server.listen(DEFAULT_PORT, "127.0.0.1", () => {
        console.log(`Petra server listening on http://127.0.0.1:${DEFAULT_PORT}`);
        resolve();
      });
    });
  }

  /** Stop the server */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const url = new URL(req.url || "/", `http://127.0.0.1:${DEFAULT_PORT}`);
    const path = url.pathname;
    const method = req.method || "GET";

    // Health check - no auth required
    if (path === "/health" && method === "GET") {
      this.sendJson(res, { ok: true, data: { status: "healthy" } });
      return;
    }

    // Check auth for all other endpoints
    if (!this.checkAuth(req)) {
      this.sendError(res, 401, "AUTH_REQUIRED", "Authorization required");
      return;
    }

    // Find matching route
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const match = path.match(route.pattern);
      if (!match) continue;

      // Extract params
      const params: Record<string, string> = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(match[i + 1]);
      });

      // Parse body for POST/PUT
      let body: unknown;
      try {
        body = await this.parseBody(req);
      } catch (err) {
        if (err instanceof Error && err.message === "Request body too large") {
          this.sendError(res, 413, "INTERNAL_ERROR", "Request body too large");
          return;
        }
        throw err;
      }

      await route.handler(req, res, params, body);
      return;
    }

    // No route found
    this.sendError(res, 404, "NOT_FOUND", `Route not found: ${method} ${path}`);
  }

  private checkAuth(req: http.IncomingMessage): boolean {
    if (!this.authToken) return true; // No token set = no auth required

    const authHeader = req.headers.authorization;
    if (!authHeader) return false;

    const [type, token] = authHeader.split(" ");
    if (type !== "Bearer" || !token) return false;

    // Use timing-safe comparison to prevent timing attacks
    try {
      const provided = Buffer.from(token, "utf-8");
      const expected = Buffer.from(this.authToken, "utf-8");
      if (provided.length !== expected.length) return false;
      return timingSafeEqual(provided, expected);
    } catch {
      return false;
    }
  }

  private async parseBody(req: http.IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      let totalSize = 0;

      req.on("data", (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > MAX_BODY_SIZE) {
          req.destroy();
          reject(new Error("Request body too large"));
          return;
        }
        chunks.push(chunk);
      });

      req.on("end", () => {
        const body = Buffer.concat(chunks).toString();
        if (!body) {
          resolve(undefined);
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });

      req.on("error", reject);
    });
  }

  /** Send JSON response */
  sendJson<T>(res: http.ServerResponse, data: ApiResponse<T>): void {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(200);
    res.end(JSON.stringify(data));
  }

  /** Send error response */
  sendError(
    res: http.ServerResponse,
    status: number,
    code: string,
    message: string
  ): void {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(status);
    const error: ApiError = { ok: false, error: { code: code as any, message } };
    res.end(JSON.stringify(error));
  }
}
