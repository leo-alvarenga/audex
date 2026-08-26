import ffmpeg from "fluent-ffmpeg";
import { mkdir, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";
import type { TrackMeta } from "./types.js";

export async function transcode(
  src: string,
  dest: string,
  meta?: TrackMeta,
): Promise<void> {
  const tmp = `${dest}.part`;
  await mkdir(dirname(dest), { recursive: true });

  try {
    await new Promise<void>((resolve, reject) => {
      const cmd = ffmpeg(src)
        .noVideo()
        .audioCodec("aac")
        .audioBitrate(256) // 256 kbps -> Limit for AAC
        .audioChannels(2)
        .audioFrequency(44100)
        .format("ipod")
        // Copy every source tag, then overlay resolved metadata on top.
        .outputOptions("-map_metadata", "0");

      if (meta) {
        const tags: Array<[string, string]> = [
          ["title", meta.title],
          ["artist", meta.artist],
          ["album", meta.album],
          ["track", meta.track ? String(meta.track) : ""],
          ["album_artist", meta.albumArtist ?? meta.artist],
          ["genre", meta.genre ?? ""],
          ["date", meta.year ? String(meta.year) : ""],
        ];

        for (const [k, v] of tags) {
          if (v) cmd.outputOptions("-metadata", `${k}=${v}`);
        }
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
  }
}
