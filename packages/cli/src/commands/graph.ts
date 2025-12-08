// packages/cli/src/commands/graph.ts

import { Command } from "commander";
import chalk from "chalk";
import { requireBridge } from "../lib/bridge.js";

export function graphCommands(parent: Command): void {
  const graph = parent
    .command("graph")
    .description("Graph operations (requires bridge)");

  graph
    .command("neighbors <path>")
    .description("Show notes connected to this note")
    .option("-d, --depth <n>", "Traversal depth", "1")
    .option("--direction <dir>", "Direction: in, out, or both", "both")
    .action(async (path, options) => {
      try {
        const client = await requireBridge();
        const params = new URLSearchParams({
          depth: options.depth,
          direction: options.direction,
        });

        const result = await client.get<Array<{
          path: string;
          title: string;
          direction: "in" | "out";
        }>>(`/graph/neighbors/${encodeURIComponent(path)}?${params}`);

        if (!result.ok) {
          console.error(chalk.red(result.error.message));
          process.exit(1);
        }

        const neighbors = result.data;

        if (neighbors.length === 0) {
          console.log(chalk.dim("No connected notes found"));
          return;
        }

        const incoming = neighbors.filter(n => n.direction === "in");
        const outgoing = neighbors.filter(n => n.direction === "out");

        if (incoming.length > 0) {
          console.log(chalk.green(`\nIncoming links (${incoming.length}):`));
          for (const n of incoming) {
            console.log(`  ${chalk.cyan("←")} ${chalk.bold(n.title)}`);
            console.log(chalk.dim(`      ${n.path}`));
          }
        }

        if (outgoing.length > 0) {
          console.log(chalk.green(`\nOutgoing links (${outgoing.length}):`));
          for (const n of outgoing) {
            console.log(`  ${chalk.cyan("→")} ${chalk.bold(n.title)}`);
            console.log(chalk.dim(`      ${n.path}`));
          }
        }
      } catch (err) {
        if (err instanceof Error) {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });

  graph
    .command("query")
    .description("Query the link graph")
    .option("-f, --from <path>", "Starting note path")
    .option("-d, --depth <n>", "Traversal depth", "1")
    .option("--direction <dir>", "Direction: in, out, or both", "both")
    .option("--json", "Output as JSON")
    .action(async (options) => {
      try {
        const client = await requireBridge();

        const result = await client.post<{
          nodes: Array<{ id: string; title: string; group?: string }>;
          edges: Array<{ source: string; target: string; type: string }>;
        }>("/graph/query", {
          from: options.from,
          depth: parseInt(options.depth),
          direction: options.direction,
        });

        if (!result.ok) {
          console.error(chalk.red(result.error.message));
          process.exit(1);
        }

        const { nodes, edges } = result.data;

        if (options.json) {
          console.log(JSON.stringify(result.data, null, 2));
          return;
        }

        console.log(chalk.green(`Graph: ${nodes.length} nodes, ${edges.length} edges\n`));

        console.log(chalk.bold("Nodes:"));
        for (const node of nodes.slice(0, 20)) {
          console.log(`  ${node.title} ${chalk.dim(`(${node.id})`)}`);
        }
        if (nodes.length > 20) {
          console.log(chalk.dim(`  ... and ${nodes.length - 20} more`));
        }

        console.log(chalk.bold("\nEdges:"));
        for (const edge of edges.slice(0, 20)) {
          console.log(`  ${edge.source} ${chalk.cyan("→")} ${edge.target}`);
        }
        if (edges.length > 20) {
          console.log(chalk.dim(`  ... and ${edges.length - 20} more`));
        }
      } catch (err) {
        if (err instanceof Error) {
          console.error(chalk.red(err.message));
        }
        process.exit(1);
      }
    });
}
