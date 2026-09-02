import { parseFile } from "music-metadata";
import { lookupByFingerprint } from "./autotag.js";
import type { TrackMeta } from "./types.js";

export async function extractLocalTags(
  file: string,
): Promise<Partial<TrackMeta>> {
  try {
    const mm = await parseFile(file);
    const c = mm.common;

    return {
      year: c.year,
      album: c.album,
      title: c.title,
      genre: c.genre?.[0],
      track: c.track?.no ?? 0,
      albumArtist: c.albumartist,
      artist: c.artist ?? c.albumartist ?? c.artists?.[0],
    };
  } catch {
    return {};
  }
}

/**
 * Metadata fallback chain for tagging the output: local tags -> AcoustID /
 * MusicBrainz (only when --auto-tag and tags are missing). Unresolved fields
 * stay empty; ffmpeg's -map_metadata 0 copies the rest of the source tags.
 */
export async function resolveMetadata(
  file: string,
  opts: { autoTag: boolean },
): Promise<TrackMeta> {
  const local = await extractLocalTags(file);

  const meta: TrackMeta = {
    year: local.year,
    genre: local.genre,
    track: local.track ?? 0,
    album: local.album ?? "",
    title: local.title ?? "",
    artist: local.artist ?? "",
    albumArtist: local.albumArtist,
  };

  const incomplete = () => !meta.title || !meta.artist || !meta.album;

  if (incomplete() && opts.autoTag) {
    const remote = await lookupByFingerprint(file);

    if (remote) {
      if (!meta.title) meta.title = remote.title ?? "";
      if (!meta.artist) meta.artist = remote.artist ?? "";
      if (!meta.album) meta.album = remote.album ?? "";
      if (!meta.track) meta.track = remote.track ?? 0;
    }
  }

  return meta;
}

function defined(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.length > 0;
  if (typeof v === "number") return v > 0;
  return true;
}

function pick<T>(a: T | undefined, b: T | undefined): T | undefined {
  return defined(a) ? a : b;
}

/**
 * Full resolution for the tag command: always queries remote (so plan/apply
 * are complete), preferring remote when overwriting and local otherwise.
 */
export async function resolveTagMetadata(
  file: string,
  opts: { overwrite: boolean },
): Promise<TrackMeta> {
  const local = await extractLocalTags(file);
  const remote = await lookupByFingerprint(file);

  const primary = opts.overwrite ? remote : local;
  const fallback = opts.overwrite ? local : remote;

  return {
    title: pick(primary?.title, fallback?.title) ?? "",
    artist: pick(primary?.artist, fallback?.artist) ?? "",
    album: pick(primary?.album, fallback?.album) ?? "",
    albumArtist: pick(primary?.albumArtist, fallback?.albumArtist),
    genre: pick(primary?.genre, fallback?.genre),
    track: pick(primary?.track, fallback?.track) ?? 0,
    year: pick(primary?.year, fallback?.year),
    coverUrl: remote?.coverUrl,
  };
}

/**
 * Map metadata (partial ok) to flat ffmpeg `-metadata` tag pairs. Empty or
 * unknown values become empty strings so callers decide whether to write or clear.
 */
export function metaTags(
  meta: Partial<TrackMeta>,
): Array<[string, string]> {
  return [
    ["title", meta.title ?? ""],
    ["artist", meta.artist ?? ""],
    ["album", meta.album ?? ""],
    ["track", meta.track ? String(meta.track) : ""],
    ["album_artist", meta.albumArtist ?? meta.artist ?? ""],
    ["genre", meta.genre ?? ""],
    ["date", meta.year ? String(meta.year) : ""],
  ];
}
