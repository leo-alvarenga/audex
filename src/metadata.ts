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
