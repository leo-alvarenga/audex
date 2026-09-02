import { writeFile } from "node:fs/promises";
import { extname } from "node:path";
import { parseFile } from "music-metadata";
import { MB_UA } from "./constants.js";
import type { TrackMeta } from "./types.js";

const LRCLIB = "https://lrclib.net/api/get";

// Same filename as the audio, extension swapped to .lrc, character-for-character.
export function lrcPath(audioPath: string): string {
  const ext = extname(audioPath);

  return audioPath.slice(0, audioPath.length - ext.length) + ".lrc";
}

async function resolveLyricsMeta(
  srcFile: string,
  meta: Partial<TrackMeta> | undefined,
): Promise<{
  artist: string;
  title: string;
  album: string;
  duration: number;
} | null> {
  try {
    const mm = await parseFile(srcFile);
    const artist =
      meta?.artist ||
      mm.common.artist ||
      mm.common.albumartist ||
      mm.common.artists?.[0] ||
      "";

    const album = meta?.album || mm.common.album || "";
    const title = meta?.title || mm.common.title || "";
    if (!artist || !title) return null;

    return {
      artist,
      title,
      album,
      duration: Math.round(mm.format.duration ?? 0),
    };
  } catch {
    return null;
  }
}

export async function fetchSyncedLyrics(
  srcFile: string,
  meta: Partial<TrackMeta> | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<string | null> {
  const info = await resolveLyricsMeta(srcFile, meta);
  if (!info) return null;

  const params = new URLSearchParams({
    artist_name: info.artist,
    track_name: info.title,
  });

  if (info.album) params.set("album_name", info.album);
  if (info.duration) params.set("duration", String(info.duration));

  try {
    const res = await fetchFn(`${LRCLIB}?${params}`, {
      headers: { "User-Agent": MB_UA },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { syncedLyrics?: unknown };

    return typeof data.syncedLyrics === "string" && data.syncedLyrics
      ? data.syncedLyrics
      : null;
  } catch {
    return null;
  }
}

// Writes the .lrc next to the audio file; returns false when no lyrics found
export async function writeLyrics(
  audioDest: string,
  srcFile: string,
  meta: Partial<TrackMeta> | undefined,
  fetchFn?: typeof fetch,
): Promise<boolean> {
  const lrc = await fetchSyncedLyrics(srcFile, meta, fetchFn ?? fetch);
  if (lrc === null) return false;

  await writeFile(lrcPath(audioDest), lrc);
  return true;
}
