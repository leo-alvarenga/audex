import { writeAudio } from "./ffmpeg.js";
import type { TrackMeta } from "./types.js";

export async function transcode(
  src: string,
  dest: string,
  meta?: TrackMeta,
): Promise<void> {
  await writeAudio(src, dest, meta, (cmd) =>
    cmd
      .noVideo()
      .audioCodec("aac")
      .audioBitrate(256) // 256 kbps -> limit for AAC
      .audioChannels(2)
      .audioFrequency(44100)
      .format("ipod"),
  );
}
