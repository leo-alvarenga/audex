import { cpus, tmpdir } from "node:os";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, join, relative } from "node:path";
import ffmpeg from "fluent-ffmpeg";
import pLimit from "p-limit";
import cliProgress from "cli-progress";
import { scanFiles } from "./scan.js";
import { extractLocalTags, metaTags, resolveTagMetadata } from "./metadata.js";
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

// existing tags win; planned values only fill gaps.
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
  const tmp = `${dest}.part`;
  await mkdir(dirname(dest), { recursive: true });
  const cover = await resolveCover(meta.coverUrl);

  try {
    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg(src);
      if (cover) cmd.input(cover.path);

      cmd
        .outputOptions("-c", "copy")
        .outputOptions("-map_metadata", "0")
        .format(formatFor(dest));

      if (cover) {
        cmd
          .outputOptions("-map", "0:a")
          .outputOptions("-map", "1")
          .outputOptions("-disposition:v", "attached_pic");
      }

      // overwrite: write every known tag (empty clears it); merge: only non-empty.
      for (const [k, v] of metaTags(meta)) {
        if (opts.overwrite || v) cmd.outputOptions("-metadata", `${k}=${v}`);
      }

      cmd
        .on("end", () => resolve())
        .on("error", (err, _stdout, stderr) => {
          const detail = (stderr ?? "").trim().split("\n").slice(-6).join("\n");
          reject(new Error(`${err.message}${detail ? `\n${detail}` : ""}`));
        })
        .save(tmp);
    });

    await rename(tmp, dest);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
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

  const limit = pLimit(cpus().length);
  const bar = new cliProgress.SingleBar(
    { format: "planning [{bar}] {percentage}% | {value}/{total} | {file}" },
    cliProgress.Presets.shades_classic,
  );
  bar.start(files.length, 0);

  await Promise.all(
    files.map((file) =>
      limit(async () => {
        const rel = relative(inputDir, file);
        plan.files[rel] = await resolveTagMetadata(file, opts);
        bar.increment(1, { file: rel });
      }),
    ),
  );
  bar.stop();

  await writeFile(path, JSON.stringify(plan, null, 2) + "\n");
  console.log(`Wrote plan for ${files.length} file(s): ${path}`);
}

async function processFiles(
  inputDir: string,
  outDir: string | null,
  resolvePlanned: (file: string) => Promise<Partial<TrackMeta> | null>,
  overwrite: boolean,
): Promise<void> {
  const files = await scanFiles(inputDir, AUDIO_EXTS);
  if (files.length === 0) {
    console.log(`No audio files found in ${inputDir}`);
    return;
  }

  const limit = pLimit(cpus().length);
  const bar = new cliProgress.SingleBar(
    { format: "tagging [{bar}] {percentage}% | {value}/{total} | {file}" },
    cliProgress.Presets.shades_classic,
  );
  bar.start(files.length, 0);

  let tagged = 0;
  await Promise.all(
    files.map((file) =>
      limit(async () => {
        const rel = relative(inputDir, file);
        const planned = await resolvePlanned(file);
        bar.increment(1, { file: rel });
        if (planned === null) return;

        const existing = await extractLocalTags(file);
        const final = overwrite ? planned : mergeMeta(existing, planned);
        const dest = outDir ? join(outDir, rel) : file;
        await writeTags(file, dest, final, { overwrite });
        tagged++;
      }),
    ),
  );
  bar.stop();

  console.log(
    `Done: ${tagged} file(s) tagged${outDir ? ` into ${outDir}` : " in place"}.`,
  );
}

export async function applyPlan(
  inputDir: string,
  outDir: string | null,
  opts: { overwrite: boolean },
): Promise<void> {
  const plan = JSON.parse(
    await readFile(planPath(inputDir), "utf8"),
  ) as TagPlan;
  await processFiles(
    inputDir,
    outDir,
    (file) => Promise.resolve(plan.files[relative(inputDir, file)] ?? null),
    opts.overwrite,
  );
}

export async function defaultAction(
  inputDir: string,
  outDir: string | null,
  opts: { overwrite: boolean },
): Promise<void> {
  await processFiles(
    inputDir,
    outDir,
    (file) => resolveTagMetadata(file, opts),
    opts.overwrite,
  );
}
