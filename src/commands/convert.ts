import { Command } from "commander";
import { resolve } from "node:path";
import { convert } from "../convert.js";
import { assertDir } from "../fs.js";

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

        await assertDir(outDir, "output");

        await convert(inputDir, outDir, {
          autoTag: opts.autoTag,
          dryRun: opts.dryRun,
          includeLyrics: opts.includeLyrics,
        });
      },
    );
}
