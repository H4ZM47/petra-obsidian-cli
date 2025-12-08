import esbuild from "esbuild";
import { mkdir } from "fs/promises";

const watch = process.argv.includes("--watch");

await mkdir("dist", { recursive: true });

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "fs", "os", "path", "http"],
  platform: "node",
  format: "cjs",
  target: "es2018",
  outfile: "dist/main.js",
  logLevel: "info",
  sourcemap: "inline",
  treeShaking: true,
});

if (watch) {
  await context.watch();
  console.log("Watching for changes...");
} else {
  await context.rebuild();
  await context.dispose();
}
