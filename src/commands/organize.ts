import { Command } from "commander";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { access, copyFile, mkdir, rename, stat, unlink } from "node:fs/promises";
import * as readline from "node:readline";
import { parseFile } from "music-metadata";
import { assertDir } from "../fs.js";
import { scanFiles } from "../scan.js";
import { AUDIO_EXTS } from "../tagger.js";
import { runWithProgress } from "../progress.js";
import {
  openLibrary,
  isLibraryIndexed,
  pruneLibrary,
  registerLibrary,
  trackUnchanged,
  upsertTrack,
  queryTracks,
} from "../library.js";
import type { LibraryTrack } from "../library.js";

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
  const trackPrefix = track.track ? String(track.track).padStart(2, "0") + " - " : "";
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
  inputDir: string,
  force: boolean,
): Promise<void> {
  const files = await scanFiles(inputDir, AUDIO_EXTS);

  await runWithProgress(
    "indexing",
    files,
    (file) => relative(inputDir, file),
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
        libraryRoot: inputDir,
      });
    },
  );
  pruneLibrary(db, inputDir, files);
}

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}

export function organizeCommand(): Command {
  return new Command()
    .name("organize")
    .description("Organize library files into Artist/Album/Track layout")
    .argument("<input>", "library root directory")
    .argument("[output]", "output directory (default: in-place)")
    .option("--copy", "copy files instead of moving")
    .option("--force-index", "re-index even if library is already known")
    .option("--force", "overwrite existing destination files instead of skipping")
    .action(
      async (
        input: string,
        output: string | undefined,
        opts: { copy: boolean; forceIndex: boolean; force: boolean },
      ) => {
        const inputDir = resolve(input);
        await assertDir(inputDir, "input");

        const outDir = output ? resolve(output) : inputDir;
        if (outDir !== inputDir) await assertDir(outDir, "output");

        const db = openLibrary();

        if (!isLibraryIndexed(db, inputDir) || opts.forceIndex) {
          registerLibrary(db, inputDir);
          await indexDir(db, inputDir, opts.forceIndex ?? false);
        }

        const tracks = queryTracks(db, "*", inputDir);
        db.close();

        if (tracks.length === 0) {
          console.log(`No indexed tracks found for ${inputDir}.`);
          return;
        }

        const plan: { from: string; to: string }[] = [];
        for (const t of tracks) {
          const to = await buildTargetPath(outDir, t, t.path, opts.force);
          if (to === null || t.path === to) continue;
          plan.push({ from: t.path, to });
        }

        if (plan.length === 0) {
          console.log("Already organized. Nothing to do.");
          return;
        }

        const preview = plan.slice(0, 20);
        for (const { from, to } of preview) {
          console.log(`  ${from}\n    → ${to}`);
        }
        if (plan.length > 20) console.log(`  ... and ${plan.length - 20} more`);
        const verb = opts.copy ? "copied" : "moved";
        console.log(`\n${plan.length} file(s) will be ${verb}.`);

        const ok = await confirm("Execute plan? [y/N] ");
        if (!ok) {
          console.log("Aborted.");
          return;
        }

        const fromToMap = new Map(plan.map(({ from, to }) => [from, to]));
        await runWithProgress(
          verb,
          plan.map((p) => p.from),
          (f) => relative(inputDir, f),
          async (from) => {
            const to = fromToMap.get(from)!;
            await mkdir(dirname(to), { recursive: true });
            if (opts.copy) {
              await copyFile(from, to);
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
            }
          },
        );

        console.log(`Done. ${plan.length} file(s) ${verb}.`);
      },
    );
}
