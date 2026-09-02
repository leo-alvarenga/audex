import { writeAudio } from "./ffmpeg.js";
import type { TrackMeta } from "./types.js";

export async function transcode(
  src: string,
  dest: string,
  meta?: TrackMeta,
): Promise<void> {
  await writeAudio(src, dest, meta, (cmd) =>
    cmd
      .outputOptions("-map", "0:a")
      .outputOptions("-map", "0:v?") // keep embedded cover art when present
      .audioCodec("aac")
      .audioBitrate(256) // 256 kbps -> limit for AAC
      .audioChannels(2)
      .audioFrequency(44100)
      .outputOptions("-c:v", "copy")
      .outputOptions("-disposition:v", "attached_pic")
      .format("ipod"),
  );
}
