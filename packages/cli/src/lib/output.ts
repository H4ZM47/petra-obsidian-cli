// packages/cli/src/lib/output.ts

import chalk from "chalk";
import type { OutputFormat, GlobalOptions } from "@petra/shared";
import { getConfigValue } from "./config.js";

let globalOptions: GlobalOptions = {};

export function setGlobalOptions(opts: GlobalOptions): void {
  globalOptions = opts;
}

export function getOutputFormat(): OutputFormat {
  // Priority: CLI flag > env var > config
  if (globalOptions.quiet) return "quiet";
  if (globalOptions.json) return "json";

  const envFormat = process.env.PETRA_OUTPUT;
  if (envFormat === "json" || envFormat === "quiet" || envFormat === "pretty") {
    return envFormat;
  }

  const configFormat = getConfigValue("output") as OutputFormat | undefined;
  if (configFormat) return configFormat;

  return "pretty";
}

/** Output data in the appropriate format */
export function output<T>(data: T, prettyFn?: (data: T) => void): void {
  const format = getOutputFormat();

  if (format === "quiet") {
    return;
  }

  if (format === "json") {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  if (prettyFn) {
    prettyFn(data);
  } else {
    console.log(data);
  }
}

/** Output success message */
export function success(message: string): void {
  const format = getOutputFormat();

  if (format === "quiet") return;
  if (format === "json") {
    console.log(JSON.stringify({ ok: true, message }));
    return;
  }

  console.log(chalk.green(message));
}

/** Output error message */
export function error(message: string, code?: string): void {
  const format = getOutputFormat();

  if (format === "json") {
    console.error(JSON.stringify({ ok: false, error: { code, message } }));
    return;
  }

  console.error(chalk.red(message));
}
