import { tmpdir } from "node:os";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { scanFiles } from "./scan.js";
import { extractLocalTags, hasCoreMeta, resolveTagMetadata } from "./metadata.js";
import { writeAudio } from "./ffmpeg.js";
import { writeLyrics } from "./lyrics.js";
import { runWithProgress } from "./progress.js";
import type { TrackMeta } from "./types.js";

export const AUDIO_EXTS = [".flac", ".m4a", ".mp3"];

const FORMAT_BY_EXT: Record<string, string> = {
  ".flac": "flac",
  ".m4a": "ipod",
  ".mp3": "mp3",
};

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
): Promise<boolean> {
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

  return cover !== null;
}

export async function tagFiles(
  inputDir: string,
  outDir: string | null,
  opts: { overwrite: boolean; includeLyrics: boolean },
): Promise<void> {
  const files = await scanFiles(inputDir, AUDIO_EXTS);

  if (files.length === 0) {
    console.log(`No audio files found in ${inputDir}`);
    return;
  }

  let tagged = 0;
  let complete = 0;
  let missingCover = 0;
  let missingLyrics = 0;
  let missingMeta = 0;

  await runWithProgress(
    "tagging",
    files,
    (file) => relative(inputDir, file),
    async (file) => {
      const rel = relative(inputDir, file);
      const planned = await resolveTagMetadata(file, opts);
      const existing = await extractLocalTags(file);
      const final = opts.overwrite ? planned : mergeMeta(existing, planned);
      const dest = outDir ? join(outDir, rel) : file;

      const gotCover = await writeTags(file, dest, final, {
        overwrite: opts.overwrite,
      });
      const gotLyrics = opts.includeLyrics
        ? await writeLyrics(dest, file, final)
        : true;
      const gotMeta = hasCoreMeta(final);

      tagged++;
      if (!gotCover) missingCover++;
      if (!gotMeta) missingMeta++;
      if (!gotLyrics) missingLyrics++;
      if (gotCover && gotMeta && gotLyrics) complete++;
    },
  );

  console.log(
    `Done: ${tagged} file(s) tagged${outDir ? ` into ${outDir}` : " in place"}.`,
  );
  console.log(`  complete successes: ${complete}`);
  console.log(`  missing cover art: ${missingCover}`);
  if (opts.includeLyrics) {
    console.log(`  missing lyrics: ${missingLyrics}`);
  }
  console.log(`  missing metadata: ${missingMeta}`);
}

export async function previewTags(
  inputDir: string,
  opts: { overwrite: boolean },
): Promise<void> {
  const files = await scanFiles(inputDir, AUDIO_EXTS);

  if (files.length === 0) {
    console.log(`No audio files found in ${inputDir}`);
    return;
  }

  const resolved = new Map<string, TrackMeta>();

  await runWithProgress(
    "previewing",
    files,
    (file) => relative(inputDir, file),
    async (file) => {
      resolved.set(file, await resolveTagMetadata(file, opts));
    },
  );

  console.log(`\nWould tag ${files.length} file(s):`);
  for (const file of files) {
    const m = resolved.get(file)!;
    const title = m.title || "(no title)";
    const artist = m.artist || "(no artist)";
    const album = m.album || "(no album)";
    const year = m.year ? ` (${m.year})` : "";

    console.log(`  ${relative(inputDir, file)}`);
    console.log(`    ${title} — ${artist} — ${album}${year}`);
    console.log(`    cover: ${m.coverUrl ? "yes" : "no"}`);
  }
}
