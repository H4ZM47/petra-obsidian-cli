import esbuild from "esbuild";
import { mkdir } from "fs/promises";

const watch = process.argv.includes("--watch");

await mkdir("dist", { recursive: true });

const context = await esbuild.context({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node18",
  outfile: "dist/index.cjs",
  logLevel: "info",
  sourcemap: true,
  treeShaking: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
});

if (watch) {
  await context.watch();
  console.log("Watching for changes...");
} else {
  await context.rebuild();
  await context.dispose();
}
