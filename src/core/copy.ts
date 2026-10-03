import { copyFile, mkdir } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { openLibrary, queryTracks } from "../library.js";
import type { LibraryTrack } from "../library.js";
import { fileExists } from "../fs.js";
import { runWithProgress } from "../progress.js";
import type { OperationResult, ProgressCallback } from "../types.js";

function relToRoot(t: LibraryTrack): string {
  if (!t.libraryRoot) return basename(t.path);
  const rel = relative(t.libraryRoot, t.path);
  return rel.startsWith("..") || isAbsolute(rel) ? basename(t.path) : rel;
}

export async function copyTracks(
  pattern: string,
  outDir: string,
  opts: { library?: string; force: boolean },
  onProgress?: ProgressCallback,
): Promise<OperationResult> {
  const db = openLibrary();
  const tracks = queryTracks(db, pattern, opts.library);
  db.close();

  if (!tracks.length) {
    return { ok: true, stats: { copied: 0, skipped: 0, missing: 0 }, errors: [] };
  }

  await mkdir(outDir, { recursive: true });
  let copied = 0;
  let skipped = 0;
  const errors: string[] = [];

  await runWithProgress(
    tracks,
    async (t) => {
      const dest = join(outDir, relToRoot(t));
      if (!opts.force && await fileExists(dest)) { skipped++; return; }
      await mkdir(dirname(dest), { recursive: true });
      try {
        await copyFile(t.path, dest);
        copied++;
      } catch {
        errors.push(`[missing] ${t.path}`);
      }
    },
    onProgress,
    (t) => t.path,
  );

  return { ok: errors.length === 0, stats: { copied, skipped, missing: errors.length }, errors };
}
