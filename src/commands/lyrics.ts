import { Command } from "commander";
import { mkdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { assertDir, fileExists } from "../fs.js";
import { lrcPath, writeLyrics } from "../lyrics.js";
import { runWithProgress } from "../progress.js";
import { scanFiles } from "../scan.js";
import { AUDIO_EXTS } from "../tagger.js";

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
        const inputDir = resolve(input);
        const outDir = output ? resolve(output) : null;

        await assertDir(inputDir, "input");
        if (outDir) await assertDir(outDir, "output");

        const files = await scanFiles(inputDir, AUDIO_EXTS);

        if (files.length === 0) {
          console.log(`No audio files found in ${inputDir}`);
          return;
        }

        let found = 0;
        let missing = 0;
        let skipped = 0;

        await runWithProgress(
          "lyrics",
          files,
          (file) => relative(inputDir, file),
          async (file) => {
            const dest = outDir
              ? lrcPath(join(outDir, relative(inputDir, file)))
              : file;

            if (opts.dryRun) {
              console.log(`  ${lrcPath(dest)}`);
              found++;
              return;
            }

            const lrc = lrcPath(dest);
            if (await fileExists(lrc)) { skipped++; return; }

            if (outDir) await mkdir(dirname(dest), { recursive: true });

            if (await writeLyrics(dest, file, undefined)) found++;
            else missing++;
          },
        );

        console.log(`\n${found} found, ${missing} missing, ${skipped} skipped (already exist)`);
        if (missing > 0) {
          console.log("Tracks without available lyrics on LRCLIB are skipped.");
        }
      },
    );
}
