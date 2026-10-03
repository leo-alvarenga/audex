import { basename, dirname, extname, join, relative } from "node:path";
import { access, copyFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import { parseFile } from "music-metadata";
import { openLibrary, isLibraryIndexed, queryTracks, registerLibrary, trackUnchanged, upsertTrack, pruneLibrary } from "../library.js";
import { scanFiles } from "../scan.js";
import { AUDIO_EXTS } from "../tagger.js";
import { runWithProgress } from "../progress.js";
import type { LibraryTrack } from "../library.js";
import type { OperationResult, ProgressCallback } from "../types.js";

function sanitize(s: string): string {
  return s.replace(/[/\\:*?"<>|]/g, "_").replace(/[.\s]+$/, "").trim() || "_";
}

async function buildTargetPath(
  outDir: string,
  track: LibraryTrack,
  originalPath: string,
  force: boolean,
): Promise<string | null> {
  const ext = extname(originalPath).toLowerCase();
  const artist = sanitize(track.albumArtist ?? track.artist ?? "Unknown Artist");
  const album = sanitize(track.album ?? "Unknown Album");
  const trackPrefix = track.track ? String(track.track).padStart(2, "0") + ". " : "";
  const title = sanitize(track.title ?? basename(originalPath, ext));

  const candidate = join(outDir, artist, album, `${trackPrefix}${title}${ext}`);

  if (candidate === originalPath) return candidate;

  try {
    await access(candidate);
    return force ? candidate : null;
  } catch {
    // file does not exist — candidate is free
  }

  return candidate;
}

async function indexDir(
  db: ReturnType<typeof openLibrary>,
  dir: string,
  force: boolean,
): Promise<void> {
  const files = await scanFiles(dir, AUDIO_EXTS);

  await runWithProgress(
    files,
    async (file) => {
      const info = await stat(file);
      const size = info.size;
      const mtime = Math.floor(info.mtimeMs);

      if (!force && trackUnchanged(db, file, size, mtime)) return;

      const mm = await parseFile(file).catch(() => null);
      const c = mm?.common;

      upsertTrack(db, {
        path: file,
        artist: c?.artist ?? c?.albumartist ?? c?.artists?.[0] ?? null,
        album: c?.album ?? null,
        albumArtist: c?.albumartist ?? null,
        title: c?.title ?? null,
        track: c?.track?.no ?? null,
        year: c?.year ?? null,
        genre: c?.genre?.[0] ?? null,
        duration: mm?.format.duration ?? null,
        fileSize: size,
        mtime,
        libraryRoot: dir,
      });
    },
    undefined,
    (file) => relative(dir, file),
  );
  pruneLibrary(db, dir, files);
}

export async function organizeLibrary(
  inputDir: string,
  outputDir: string | null,
  opts: { copy: boolean; forceIndex: boolean; force: boolean },
  onProgress?: ProgressCallback,
): Promise<Omit<OperationResult, "plan"> & { plan: { from: string; to: string }[] }> {
  const outDir = outputDir ?? inputDir;
  const db = openLibrary();

  if (!isLibraryIndexed(db, inputDir) || opts.forceIndex) {
    registerLibrary(db, inputDir);
    await indexDir(db, inputDir, opts.forceIndex ?? false);
  }

  const tracks = queryTracks(db, "*", inputDir);
  db.close();

  const filePlan: { from: string; to: string }[] = [];
  for (const t of tracks) {
    const to = await buildTargetPath(outDir, t, t.path, opts.force);
    if (to === null || t.path === to) continue;
    filePlan.push({ from: t.path, to });
  }

  if (filePlan.length === 0) {
    return { ok: true, stats: { moved: 0, copied: 0 }, errors: [], plan: [] };
  }

  const errors: string[] = [];
  const fromToMap = new Map(filePlan.map(({ from, to }) => [from, to]));
  let moved = 0;
  let copied = 0;

  await runWithProgress(
    filePlan.map((p) => p.from),
    async (from) => {
      const to = fromToMap.get(from)!;
      await mkdir(dirname(to), { recursive: true });
      try {
        if (opts.copy) {
          await copyFile(from, to);
          copied++;
        } else {
          try {
            await rename(from, to);
          } catch (err: unknown) {
            if ((err as NodeJS.ErrnoException).code === "EXDEV") {
              await copyFile(from, to);
              await unlink(from);
            } else {
              throw err;
            }
          }
          moved++;
        }
      } catch (err) {
        errors.push(`${from}: ${(err as Error).message}`);
      }
    },
    onProgress,
    (f) => relative(inputDir, f),
  );

  return {
    ok: errors.length === 0,
    stats: { moved, copied },
    errors,
    plan: filePlan,
  };
}
