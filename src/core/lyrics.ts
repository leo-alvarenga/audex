import { mkdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileExists } from "../fs.js";
import { lrcPath, writeLyrics } from "../lyrics.js";
import { runWithProgress } from "../progress.js";
import { scanFiles } from "../scan.js";
import { AUDIO_EXTS } from "../tagger.js";
import type { OperationResult, ProgressCallback } from "../types.js";

export async function fetchLyricsForDir(
  inputDir: string,
  outDir: string | null,
  opts: { dryRun: boolean },
  onProgress?: ProgressCallback,
): Promise<OperationResult> {
  const files = await scanFiles(inputDir, AUDIO_EXTS);

  if (files.length === 0) {
    return { ok: true, stats: { found: 0, missing: 0, skipped: 0 }, errors: [] };
  }

  let found = 0;
  let missing = 0;
  let skipped = 0;
  const plan: string[] = [];

  await runWithProgress(
    files,
    async (file) => {
      const dest = outDir
        ? lrcPath(join(outDir, relative(inputDir, file)))
        : file;

      if (opts.dryRun) {
        plan.push(`  ${lrcPath(dest)}`);
        found++;
        return;
      }

      const lrc = lrcPath(dest);
      if (await fileExists(lrc)) {
        skipped++;
        return;
      }

      if (outDir) await mkdir(dirname(dest), { recursive: true });

      if (await writeLyrics(dest, file, undefined)) found++;
      else missing++;
    },
    onProgress,
    (file) => relative(inputDir, file),
  );

  if (opts.dryRun) {
    return { ok: true, stats: { found, missing: 0, skipped: 0 }, errors: [], plan };
  }

  return { ok: true, stats: { found, missing, skipped }, errors: [] };
}
