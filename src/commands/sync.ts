import { Command } from "commander";
import { resolve } from "node:path";
import { assertDir } from "../fs.js";
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
        const originDir = resolve(origin);
        const destDir = resolve(dest);
        await assertDir(originDir, "origin");
        await runSync(originDir, destDir, {
          force: opts.force,
          dryRun: opts.dryRun,
        });
      },
    );
}
