import { Command } from "commander";
import { resolve } from "node:path";
import { assertDir } from "../fs.js";
import { cliProgressCallback } from "../progress.js";
import { runSync } from "../sync.js";

export function syncCommand(): Command {
  return new Command()
    .name("sync")
    .description("Mirror origin into dest (structure and files)")
    .argument("<origin>", "source directory")
    .argument("<dest>", "destination directory")
    .option("--dry-run", "show what would be copied/deleted without writing")
    .option(
      "--force",
      "delete files and directories in dest that are not in origin",
    )
    .action(
      async (
        origin: string,
        dest: string,
        opts: { dryRun: boolean; force: boolean },
      ) => {
        try {
          const originDir = resolve(origin);
          const destDir = resolve(dest);

          await assertDir(originDir, "origin");

          const result = await runSync(
            originDir,
            destDir,
            { force: opts.force, dryRun: opts.dryRun },
            cliProgressCallback("syncing"),
          );

          if (result.plan) {
            for (const line of result.plan) console.log(line);
            console.log(`\n${result.stats.planned} change(s) planned.`);
          } else {
            console.log(`Done: ${result.stats.copied} copied, ${result.stats.deleted} deleted.`);
          }
        } catch (err) {
          console.error(err instanceof Error ? err.message : err);
          process.exit(1);
        }
      },
    );
}
