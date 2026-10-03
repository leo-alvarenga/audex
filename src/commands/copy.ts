import { resolve } from "node:path";
import { Command } from "commander";
import { cliProgressCallback } from "../progress.js";
import { copyTracks } from "../core/copy.js";

export function copyCommand(): Command {
  return new Command()
    .name("copy")
    .description("Copy indexed tracks to an output directory")
    .argument("<output>", "destination directory (created if missing)")
    .argument("[pattern]", "search pattern (default: *)", "*")
    .option("--library <path>", "filter by library root")
    .option("--force", "overwrite existing files")
    .action(async (output: string, pattern: string, opts: { library?: string; force: boolean }) => {
      try {
        const outDir = resolve(output);
        const result = await copyTracks(
          pattern,
          outDir,
          { library: opts.library ? resolve(opts.library) : undefined, force: opts.force },
          cliProgressCallback("copying"),
        );

        if (result.stats.copied === 0 && result.stats.skipped === 0 && result.errors.length === 0) {
          console.log("No tracks found.");
          return;
        }
        for (const e of result.errors) console.warn(`\n${e}`);
        console.log(`\nDone: ${result.stats.copied} copied, ${result.stats.skipped} skipped (already exist), ${result.errors.length} missing.`);
      } catch (err) {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}
