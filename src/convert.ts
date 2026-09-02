import { cpus } from "node:os";
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { scanFiles } from "./scan.js";
import pLimit from "p-limit";
import cliProgress from "cli-progress";
import { transcode } from "./transcode.js";
import { resolveMetadata } from "./metadata.js";

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
  opts: { autoTag: boolean; dryRun: boolean },
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

  const limit = pLimit(cpus().length);

  const bar = new cliProgress.SingleBar(
    { format: "converting [{bar}] {percentage}% | {value}/{total} | {file}" },
    cliProgress.Presets.shades_classic,
  );

  bar.start(files.length, 0);

  let copied = 0;
  let converted = 0;

  await Promise.all(
    files.map((file) =>
      limit(async () => {
        const rel = relative(inputDir, file);

        try {
          const meta = opts.autoTag
            ? await resolveMetadata(file, { autoTag: true })
            : undefined;

          await transcode(file, destPath(inputDir, outDir, file), meta);

          converted++;
          bar.increment(1, { file: rel });
        } catch (err) {
          const copyDest = join(outDir, rel);

          await mkdir(dirname(copyDest), { recursive: true });
          await copyFile(file, copyDest);

          copied++;
          bar.increment(1, { file: `copied ${rel}` });

          console.warn(
            `\n[copy] ${rel}: conversion failed (${(err as Error).message}); copied original`,
          );
        }
      }),
    ),
  );

  bar.stop();

  console.log(
    `\nDone: ${converted} converted, ${copied} copied (conversion failed).`,
  );
}
