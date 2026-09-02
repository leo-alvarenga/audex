import { Command } from "commander";
import { stat } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { resolve } from "node:path";
import { scanFiles } from "../scan.js";
import {
  AUDIO_EXTS,
  applyPlan,
  defaultAction,
  generatePlan,
  hasPlan,
} from "../tagger.js";

async function ensureDir(path: string, label: string): Promise<void> {
  const info = await stat(path).catch(() => null);

  if (!info) {
    console.error(`error: ${label} directory does not exist: ${path}`);
    process.exit(1);
  }

  if (!info.isDirectory()) {
    console.error(`error: ${label} path is not a directory: ${path}`);
    process.exit(1);
  }
}

async function confirm(question: string): Promise<boolean> {
  const rl = createInterface({ input: stdin, output: stdout });

  const answer = (await rl.question(question)).trim().toLowerCase();
  rl.close();

  return answer === "y" || answer === "yes";
}

export function tagCommand(): Command {
  return new Command()
    .name("tag")
    .description("Tag audio files, or generate a reviewable tag plan")
    .argument("<input>", "input directory to scan for audio files")
    .argument(
      "[output]",
      "output directory for tagged copies (default: edit in place)",
    )
    .option("--plan", "generate a tag plan file instead of tagging")
    .option(
      "--overwrite",
      "overwrite existing tags (default: merge, existing tags take precedence)",
    )
    .action(
      async (
        input: string,
        output: string | undefined,
        opts: { plan: boolean; overwrite: boolean },
      ) => {
        const inputDir = resolve(input);
        const outDir = output ? resolve(output) : null;

        await ensureDir(inputDir, "input");
        if (outDir) await ensureDir(outDir, "output");

        if (opts.plan) {
          await generatePlan(inputDir, { overwrite: opts.overwrite });
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

        if (await hasPlan(inputDir)) {
          await applyPlan(inputDir, outDir, { overwrite: opts.overwrite });
        } else {
          await defaultAction(inputDir, outDir, { overwrite: opts.overwrite });
        }
      },
    );
}
