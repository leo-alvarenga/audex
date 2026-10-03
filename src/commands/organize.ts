import { Command } from "commander";
import { resolve } from "node:path";
import { assertDir } from "../fs.js";
import { cliProgressCallback } from "../progress.js";
import { organizeLibrary } from "../core/organize.js";

export function organizeCommand(): Command {
  return new Command()
    .name("organize")
    .description("Organize library files into Artist/Album/Track layout")
    .argument("<input>", "library root directory")
    .argument("[output]", "output directory (default: in-place)")
    .option("--copy", "copy files instead of moving")
    .option("--force-index", "re-index even if library is already known")
    .option("--force", "overwrite existing files")
    .action(
      async (
        input: string,
        output: string | undefined,
        opts: { copy: boolean; forceIndex: boolean; force: boolean },
      ) => {
        try {
          const inputDir = resolve(input);
          const outDir = output ? resolve(output) : null;
          await assertDir(inputDir, "input");
          if (outDir) await assertDir(outDir, "output");

          const result = await organizeLibrary(
            inputDir,
            outDir,
            {
              copy: opts.copy,
              forceIndex: opts.forceIndex,
              force: opts.force,
            },
            cliProgressCallback(opts.copy ? "copying" : "moving"),
          );

          if (result.plan.length === 0) {
            console.log("Already organized. Nothing to do.");
            return;
          }
          const verb = opts.copy ? "copied" : "moved";
          console.log(`Done. ${result.stats[verb]} file(s) ${verb}.`);
          if (result.errors.length > 0) {
            for (const e of result.errors) console.warn(e);
          }
        } catch (err) {
          console.error(err instanceof Error ? err.message : err);
          process.exit(1);
        }
      },
    );
}
