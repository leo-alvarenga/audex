import { tmpdir } from "node:os";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { scanFiles } from "./scan.js";
import { extractLocalTags, resolveTagMetadata } from "./metadata.js";
import { writeAudio } from "./ffmpeg.js";
import { writeLyrics } from "./lyrics.js";
import { runWithProgress } from "./progress.js";
import type { TagPlan, TrackMeta } from "./types.js";

export const PLAN_FILENAME = "audex-plan.json";
export const AUDIO_EXTS = [".flac", ".m4a", ".mp3"];

const FORMAT_BY_EXT: Record<string, string> = {
  ".flac": "flac",
  ".m4a": "ipod",
  ".mp3": "mp3",
};

export function planPath(inputDir: string): string {
  return join(inputDir, PLAN_FILENAME);
}

export async function hasPlan(inputDir: string): Promise<boolean> {
  try {
    await readFile(planPath(inputDir));
    return true;
  } catch {
    return false;
  }
}

function present(v: unknown): boolean {
  if (typeof v === "string") return v.length > 0;
  if (typeof v === "number") return v > 0;

  return false;
}

// existing tags win; planned values only fill gaps
function mergeMeta(
  existing: Partial<TrackMeta>,
  planned: Partial<TrackMeta>,
): Partial<TrackMeta> {
  return {
    title: present(existing.title) ? existing.title : planned.title,
    artist: present(existing.artist) ? existing.artist : planned.artist,
    album: present(existing.album) ? existing.album : planned.album,
    albumArtist: present(existing.albumArtist)
      ? existing.albumArtist
      : planned.albumArtist,
    genre: present(existing.genre) ? existing.genre : planned.genre,
    track: present(existing.track) ? existing.track : planned.track,
    year: present(existing.year) ? existing.year : planned.year,
    coverUrl: planned.coverUrl,
  };
}

function formatFor(path: string): string {
  const fmt = FORMAT_BY_EXT[extname(path).toLowerCase()];
  if (!fmt) throw new Error(`unsupported audio format: ${extname(path)}`);

  return fmt;
}

// Resolve a remote cover to a temp file (downloaded), or pass a local path through.
async function resolveCover(
  cover?: string,
): Promise<{ path: string; temp: boolean } | null> {
  if (!cover) return null;
  try {
    if (!/^https?:\/\//.test(cover)) {
      await readFile(cover);
      return { path: cover, temp: false };
    }

    const res = await fetch(cover);
    if (!res.ok) return null;

    const ct = res.headers.get("content-type") ?? "";
    const ext = ct.includes("png") ? ".png" : ".jpg";

    const path = join(
      tmpdir(),
      `audex-cover-${process.pid}-${Math.random().toString(36).slice(2)}${ext}`,
    );

    await writeFile(path, Buffer.from(await res.arrayBuffer()));

    return { path, temp: true };
  } catch {
    return null;
  }
}

export async function writeTags(
  src: string,
  dest: string,
  meta: Partial<TrackMeta>,
  opts: { overwrite: boolean },
): Promise<void> {
  const cover = await resolveCover(meta.coverUrl);
  try {
    await writeAudio(
      src,
      dest,
      meta,
      (cmd) => {
        cmd.outputOptions("-c", "copy").format(formatFor(dest));
        if (cover) {
          cmd
            .input(cover.path)
            .outputOptions("-map", "0:a")
            .outputOptions("-map", "1")
            .outputOptions("-disposition:v", "attached_pic");
        }
      },
      { overwrite: opts.overwrite },
    );
  } finally {
    if (cover?.temp) await unlink(cover.path).catch(() => {});
  }
}

export async function generatePlan(
  inputDir: string,
  opts: { overwrite: boolean },
): Promise<void> {
  const path = planPath(inputDir);
  if (await hasPlan(inputDir)) {
    throw new Error(
      `plan file already exists: ${path}\nDelete it, then re-run to regenerate.`,
    );
  }

  const files = await scanFiles(inputDir, AUDIO_EXTS);
  const plan: TagPlan = { version: 1, files: {} };

  await runWithProgress(
    "planning",
    files,
    (file) => relative(inputDir, file),
    async (file) => {
      const rel = relative(inputDir, file);
      plan.files[rel] = await resolveTagMetadata(file, opts);
    },
  );

  await writeFile(path, JSON.stringify(plan, null, 2) + "\n");
  console.log(`Wrote plan for ${files.length} file(s): ${path}`);
}

async function processFiles(
  inputDir: string,
  outDir: string | null,
  resolvePlanned: (file: string) => Promise<Partial<TrackMeta> | null>,
  opts: { overwrite: boolean; includeLyrics: boolean },
): Promise<void> {
  const files = await scanFiles(inputDir, AUDIO_EXTS);

  if (files.length === 0) {
    console.log(`No audio files found in ${inputDir}`);
    return;
  }

  let tagged = 0;
  let missingLyrics = 0;

  await runWithProgress(
    "tagging",
    files,
    (file) => relative(inputDir, file),
    async (file) => {
      const rel = relative(inputDir, file);
      const planned = await resolvePlanned(file);

      if (planned === null) return;

      const existing = await extractLocalTags(file);
      const final = opts.overwrite ? planned : mergeMeta(existing, planned);
      const dest = outDir ? join(outDir, rel) : file;

      await writeTags(file, dest, final, { overwrite: opts.overwrite });
      tagged++;

      if (opts.includeLyrics && !(await writeLyrics(dest, file, final))) {
        missingLyrics++;
      }
    },
  );

  if (opts.includeLyrics && missingLyrics > 0) {
    console.warn(
      `Warning: could not obtain lyrics for ${missingLyrics} of ${files.length} track(s).`,
    );
  }

  console.log(
    `Done: ${tagged} file(s) tagged${outDir ? ` into ${outDir}` : " in place"}.`,
  );
}

export async function applyPlan(
  inputDir: string,
  outDir: string | null,
  opts: { overwrite: boolean; includeLyrics: boolean },
): Promise<void> {
  const plan = JSON.parse(
    await readFile(planPath(inputDir), "utf8"),
  ) as TagPlan;

  await processFiles(
    inputDir,
    outDir,
    (file) => Promise.resolve(plan.files[relative(inputDir, file)] ?? null),
    opts,
  );
}

export async function defaultAction(
  inputDir: string,
  outDir: string | null,
  opts: { overwrite: boolean; includeLyrics: boolean },
): Promise<void> {
  await processFiles(
    inputDir,
    outDir,
    (file) => resolveTagMetadata(file, opts),
    opts,
  );
}
