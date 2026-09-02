import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { scanFiles } from "./scan.js";
import { transcode } from "./transcode.js";
import { resolveMetadata } from "./metadata.js";
import { writeLyrics } from "./lyrics.js";
import { runWithProgress } from "./progress.js";
import type { TrackMeta } from "./types.js";

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
): Promise<void> {
  const files = await scanFiles(inputDir, [".flac"]);

  if (files.length === 0) {
    console.log(`No FLAC files found in ${inputDir}`);
    return;
  }

  if (opts.dryRun) {
    console.log(`Would convert ${files.length} FLAC file(s):`);

    for (const f of files) {
      const rel = relative(inputDir, f);
      console.log(`  ${rel} -> ${rel.replace(/\.flac$/i, ".m4a")}`);
    }

    return;
  }

  let converted = 0;
  let copied = 0;
  let missingLyrics = 0;

  await runWithProgress(
    "converting",
    files,
    (file) => relative(inputDir, file),
    async (file) => {
      const rel = relative(inputDir, file);
      let meta: TrackMeta | undefined;

      try {
        meta = opts.autoTag
          ? await resolveMetadata(file, { autoTag: true })
          : undefined;

        const dest = destPath(inputDir, outDir, file);
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

        console.warn(
          `\n[copy] ${rel}: conversion failed (${(err as Error).message}); copied original`,
        );
      }
    },
  );

  if (opts.includeLyrics && missingLyrics > 0) {
    console.warn(
      `Warning: could not obtain lyrics for ${missingLyrics} of ${files.length} track(s).`,
    );
  }

  console.log(
    `\nDone: ${converted} converted, ${copied} copied (conversion failed).`,
  );
}
