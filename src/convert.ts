import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { scanFiles } from "./scan.js";
import { transcode } from "./transcode.js";
import { resolveMetadata } from "./metadata.js";
import { lrcPath, writeLyrics } from "./lyrics.js";
import { fileExists } from "./fs.js";
import { runWithProgress } from "./progress.js";
import type { OperationResult, ProgressCallback, TrackMeta } from "./types.js";

export function destPath(
  inputDir: string,
  outDir: string,
  file: string,
): string {
  return join(outDir, relative(inputDir, file).replace(/\.flac$/i, ".m4a"));
}

export async function convert(
  inputDir: string,
  outDir: string,
  opts: { autoTag: boolean; dryRun: boolean; includeLyrics: boolean },
  onProgress?: ProgressCallback,
): Promise<OperationResult> {
  const files = await scanFiles(inputDir, [".flac"]);

  if (files.length === 0) {
    return {
      ok: true,
      stats: { converted: 0, copied: 0, skipped: 0, missingLyrics: 0 },
      errors: [],
    };
  }

  if (opts.dryRun) {
    const lines = files.map((f) => {
      const rel = relative(inputDir, f);
      return `  ${rel} -> ${rel.replace(/\.flac$/i, ".m4a")}`;
    });
    return { ok: true, stats: { planned: files.length }, errors: [], plan: lines };
  }

  let converted = 0;
  let copied = 0;
  let skipped = 0;
  let missingLyrics = 0;
  const errors: string[] = [];

  await runWithProgress(
    files,
    async (file) => {
      const rel = relative(inputDir, file);
      const dest = destPath(inputDir, outDir, file);

      if (await fileExists(dest)) {
        if (!opts.includeLyrics || await fileExists(lrcPath(dest))) { skipped++; return; }
        const meta = opts.autoTag ? await resolveMetadata(file, { autoTag: true }) : undefined;
        if (!(await writeLyrics(dest, file, meta))) missingLyrics++;
        return;
      }

      let meta: TrackMeta | undefined;

      try {
        meta = opts.autoTag
          ? await resolveMetadata(file, { autoTag: true })
          : undefined;

        await transcode(file, dest, meta);
        converted++;

        if (opts.includeLyrics && !(await writeLyrics(dest, file, meta))) {
          missingLyrics++;
        }
      } catch (err) {
        const copyDest = join(outDir, rel);

        await mkdir(dirname(copyDest), { recursive: true });
        await copyFile(file, copyDest);
        copied++;

        if (opts.includeLyrics && !(await writeLyrics(copyDest, file, meta))) {
          missingLyrics++;
        }

        errors.push(
          `[copy] ${rel}: conversion failed (${(err as Error).message}); copied original`,
        );
      }
    },
    onProgress,
    (file) => relative(inputDir, file),
  );

  return { ok: true, stats: { converted, copied, skipped, missingLyrics }, errors };
}
