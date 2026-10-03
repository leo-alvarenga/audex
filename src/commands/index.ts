import { Command } from "commander";
import { resolve } from "node:path";
import { assertDir } from "../fs.js";
import { cliProgressCallback } from "../progress.js";
import { indexLibrary } from "../core/index.js";

export function indexCommand(): Command {
  return new Command()
    .name("index")
    .description("Index audio files into the local library database")
    .argument("<input>", "directory to scan")
    .option("--force", "re-index files even if mtime/size haven't changed")
    .action(async (input: string, opts: { force: boolean }) => {
      try {
        const inputDir = resolve(input);
        await assertDir(inputDir, "input");
        const result = await indexLibrary(inputDir, { force: opts.force }, cliProgressCallback("indexing"));
        console.log(`Indexed ${result.stats.indexed} file(s), skipped ${result.stats.skipped} unchanged, removed ${result.stats.pruned} stale.`);
      } catch (err) {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}
