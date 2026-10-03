import { Command } from "commander";
import { relative, resolve } from "node:path";
import { stat } from "node:fs/promises";
import { parseFile } from "music-metadata";
import { assertDir } from "../fs.js";
import { scanFiles } from "../scan.js";
import { AUDIO_EXTS } from "../tagger.js";
import { runWithProgress } from "../progress.js";
import { openLibrary, pruneLibrary, registerLibrary, trackUnchanged, upsertTrack } from "../library.js";

export function indexCommand(): Command {
  return new Command()
    .name("index")
    .description("Index audio files into the local library database")
    .argument("<input>", "directory to scan")
    .option("--force", "re-index files even if mtime/size haven't changed")
    .action(async (input: string, opts: { force: boolean }) => {
      const inputDir = resolve(input);
      await assertDir(inputDir, "input");

      const files = await scanFiles(inputDir, AUDIO_EXTS);
      const db = openLibrary();
      registerLibrary(db, inputDir);

      let indexed = 0;
      let skipped = 0;

      await runWithProgress(
        "indexing",
        files,
        (file) => relative(inputDir, file),
        async (file) => {
          const info = await stat(file);
          const size = info.size;
          const mtime = Math.floor(info.mtimeMs);

          if (!opts.force && trackUnchanged(db, file, size, mtime)) {
            skipped++;
            return;
          }

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

          indexed++;
        },
      );

      const pruned = pruneLibrary(db, inputDir, files);
      db.close();

      console.log(`Indexed ${indexed} file(s), skipped ${skipped} unchanged, removed ${pruned} stale.`);
    });
}
