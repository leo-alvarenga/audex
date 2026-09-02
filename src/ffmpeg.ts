import { mkdir, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import ffmpeg from "fluent-ffmpeg";
import { metaTags } from "./metadata.js";
import type { TrackMeta } from "./types.js";

// Shared ffmpeg write path used by both `tag` (writeTags) and `convert`
// (transcode). Caller supplies codec/format/cover via `configure`; this owns
// the temp file, the tag overlay, and error/cleanup handling
export async function writeAudio(
  src: string,
  dest: string,
  meta: Partial<TrackMeta> | undefined,
  configure: (cmd: ReturnType<typeof ffmpeg>) => void,
  opts: { overwrite?: boolean } = {},
): Promise<void> {
  const tmp = `${dest}.part`;
  await mkdir(dirname(dest), { recursive: true });

  const cmd = ffmpeg(src);
  configure(cmd);
  cmd.outputOptions("-map_metadata", "0");

  if (meta) {
    // overwrite: write every known tag (empty clears it); merge: only non-empty
    for (const [k, v] of metaTags(meta)) {
      if (opts.overwrite || v) cmd.outputOptions("-metadata", `${k}=${v}`);
    }
  }

  try {
    await new Promise<void>((resolve, reject) => {
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
  }
}
