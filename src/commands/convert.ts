import { Command } from "commander";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
import { convert } from "../convert.js";

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
      "--dry-run",
      "list files that would be converted without writing anything",
    )
    .action(
      async (
        input: string,
        output: string,
        opts: { autoTag: boolean; dryRun: boolean },
      ) => {
        const inputDir = resolve(input);
        const outDir = resolve(output);

        const info = await stat(outDir).catch(() => null);

        if (!info) {
          console.error(`error: output directory does not exist: ${outDir}`);
          process.exit(1);
        }

        if (!info.isDirectory()) {
          console.error(`error: output path is not a directory: ${outDir}`);
          process.exit(1);
        }

        await convert(inputDir, outDir, {
          autoTag: opts.autoTag,
          dryRun: opts.dryRun,
        });
      },
    );
}
