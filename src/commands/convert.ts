import { Command } from "commander";
import { resolve } from "node:path";
import { convert } from "../convert.js";
import { assertDir } from "../fs.js";
import { cliProgressCallback } from "../progress.js";

export function convertCommand(): Command {
  return new Command()
    .name("convert")
    .description(
      "Transcode FLAC files to m4a (AAC), mirroring the folder structure into the output dir",
    )
    .argument("<input>", "input directory to scan for FLAC files")
    .argument("<output>", "output directory (must already exist)")
    .option(
      "--auto-tag",
      "fetch missing metadata from MusicBrainz and AcoustID",
    )
    .option(
      "--include-lyrics",
      "write timestamped .lrc files next to each converted file",
    )
    .option(
      "--dry-run",
      "list files that would be converted without writing anything",
    )
    .action(
      async (
        input: string,
        output: string,
        opts: { autoTag: boolean; dryRun: boolean; includeLyrics: boolean },
      ) => {
        const inputDir = resolve(input);
        const outDir = resolve(output);

        try {
          await assertDir(outDir, "output");

          const result = await convert(
            inputDir,
            outDir,
            {
              autoTag: opts.autoTag,
              dryRun: opts.dryRun,
              includeLyrics: opts.includeLyrics,
            },
            cliProgressCallback("converting"),
          );

          if (result.plan) {
            console.log(`Would convert ${result.stats.planned} FLAC file(s):`);
            for (const line of result.plan) console.log(line);
          } else if (
            result.stats.converted === 0 &&
            result.stats.copied === 0 &&
            result.stats.skipped === 0
          ) {
            console.log(`No FLAC files found in ${inputDir}`);
          } else {
            if (result.errors.length > 0) {
              for (const e of result.errors) console.warn(e);
            }
            if (result.stats.missingLyrics > 0) {
              console.warn(
                `Warning: could not obtain lyrics for ${result.stats.missingLyrics} track(s).`,
              );
            }
            console.log(
              `\nDone: ${result.stats.converted} converted, ${result.stats.copied} copied (conversion failed), ${result.stats.skipped} skipped (already exist).`,
            );
          }
        } catch (err) {
          console.error((err as Error).message);
          process.exit(1);
        }
      },
    );
}
