import { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";
import { scanFiles } from "../scan.js";
import { AUDIO_EXTS, previewTags, tagFiles } from "../tagger.js";
import { assertDir } from "../fs.js";
import { cliProgressCallback } from "../progress.js";

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: stdin, output: stdout });

  const answer = (await rl.question(question)).trim().toLowerCase();
  rl.close();

  return answer === "y" || answer === "yes";
}

export function tagCommand(): Command {
  return new Command()
    .name("tag")
    .description("Tag audio files")
    .argument("<input>", "input directory to scan for audio files")
    .argument(
      "[output]",
      "output directory for tagged copies (default: edit in place)",
    )
    .option("--plan", "show what would be tagged without writing anything")
    .option(
      "--overwrite",
      "overwrite existing tags (default: merge, existing tags take precedence)",
    )
    .option(
      "--include-lyrics",
      "write timestamped .lrc files next to each tagged file",
    )
    .action(
      async (
        input: string,
        output: string | undefined,
        opts: { plan: boolean; overwrite: boolean; includeLyrics: boolean },
      ) => {
        try {
          const inputDir = resolve(input);
          const outDir = output ? resolve(output) : null;

          await assertDir(inputDir, "input");
          if (outDir) await assertDir(outDir, "output");

          if (opts.plan) {
            const result = await previewTags(
              inputDir,
              { overwrite: opts.overwrite },
              cliProgressCallback("previewing"),
            );
            for (const line of result.plan ?? []) console.log(line);
            return;
          }

          if (!outDir) {
            const files = await scanFiles(inputDir, AUDIO_EXTS);

            if (files.length === 0) {
              console.log(`No audio files found in ${inputDir}`);
              return;
            }

            const ok = await confirm(
              `About to edit ${files.length} file(s) in place. Continue? [y/N] `,
            );

            if (!ok) {
              console.error("aborted");
              process.exit(1);
            }
          }

          const result = await tagFiles(
            inputDir,
            outDir,
            { overwrite: opts.overwrite, includeLyrics: opts.includeLyrics },
            cliProgressCallback("tagging"),
          );

          if (result.stats.tagged === 0) {
            console.log(`No audio files found in ${inputDir}`);
            return;
          }

          console.log(
            `Done: ${result.stats.tagged} file(s) tagged${outDir ? ` into ${outDir}` : " in place"}.`,
          );
          console.log(`  complete successes: ${result.stats.complete}`);
          console.log(`  missing cover art: ${result.stats.missingCover}`);
          if (opts.includeLyrics) {
            console.log(`  missing lyrics: ${result.stats.missingLyrics}`);
          }
          console.log(`  missing metadata: ${result.stats.missingMeta}`);
        } catch (err) {
          console.error(err instanceof Error ? err.message : String(err));
          process.exit(1);
        }
      },
    );
}
