import { copyFile, mkdir } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { Command } from "commander";
import { openLibrary, queryTracks } from "../library.js";
import type { LibraryTrack } from "../library.js";
import { fileExists } from "../fs.js";
import { runWithProgress } from "../progress.js";

function relToRoot(t: LibraryTrack): string {
  if (!t.libraryRoot) return basename(t.path);
  const rel = relative(t.libraryRoot, t.path);
  return rel.startsWith("..") || isAbsolute(rel) ? basename(t.path) : rel;
}

export function copyCommand(): Command {
  return new Command()
    .name("copy")
    .description("Copy indexed tracks to an output directory")
    .argument("<output>", "destination directory (created if missing)")
    .argument("[pattern]", "search pattern (default: *)", "*")
    .option("--library <path>", "filter by library root")
    .option("--force", "overwrite existing files")
    .action(async (output: string, pattern: string, opts: { library?: string; force: boolean }) => {
      const outDir = resolve(output);
      const db = openLibrary();
      const tracks = queryTracks(db, pattern, opts.library ? resolve(opts.library) : undefined);
      db.close();

      if (!tracks.length) { console.log("No tracks found."); return; }

      await mkdir(outDir, { recursive: true });
      let copied = 0, skipped = 0, missing = 0;

      await runWithProgress("copying", tracks, (t) => t.path, async (t) => {
        const dest = join(outDir, relToRoot(t));
        if (!opts.force && await fileExists(dest)) { skipped++; return; }
        await mkdir(dirname(dest), { recursive: true });
        try { await copyFile(t.path, dest); copied++; }
        catch { missing++; console.warn(`\n[missing] ${t.path}`); }
      });

      console.log(`\nDone: ${copied} copied, ${skipped} skipped (already exist), ${missing} missing.`);
    });
}
