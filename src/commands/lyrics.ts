import { Command } from "commander";
import { resolve } from "node:path";
import { assertDir } from "../fs.js";
import { cliProgressCallback } from "../progress.js";
import { fetchLyricsForDir } from "../core/lyrics.js";

export function lyricsCommand(): Command {
  return new Command()
    .name("lyrics")
    .description("Fetch and write timestamped .lrc files for audio files")
    .argument("<input>", "input directory to scan for audio files")
    .argument(
      "[output]",
      "output directory for .lrc files (default: next to the source audio files)",
    )
    .option("--dry-run", "list which files would get lyrics without writing anything")
    .action(
      async (
        input: string,
        output: string | undefined,
        opts: { dryRun: boolean },
      ) => {
        try {
          const inputDir = resolve(input);
          const outDir = output ? resolve(output) : null;

          await assertDir(inputDir, "input");
          if (outDir) await assertDir(outDir, "output");

          const result = await fetchLyricsForDir(inputDir, outDir, opts, cliProgressCallback("lyrics"));

          if (result.plan) {
            for (const line of result.plan) console.log(line);
          }
          if (result.stats.found === 0 && result.stats.missing === 0 && result.stats.skipped === 0) {
            console.log(`No audio files found in ${inputDir}`);
            return;
          }
          console.log(`\n${result.stats.found} found, ${result.stats.missing} missing, ${result.stats.skipped} skipped (already exist)`);
          if (result.stats.missing > 0) {
            console.log("Tracks without available lyrics on LRCLIB are skipped.");
          }
        } catch (err) {
          console.error(err instanceof Error ? err.message : err);
          process.exit(1);
        }
      },
    );
}
