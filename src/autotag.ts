import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FpcalcResult, TrackMeta } from "./types.js";
import { MB_UA } from "./constants.js";

const execFileP = promisify(execFile);

async function runFpcalc(file: string): Promise<FpcalcResult | null> {
  try {
    const { stdout } = await execFileP("fpcalc", ["-json", file]);
    const parsed = JSON.parse(stdout) as FpcalcResult;

    return typeof parsed.duration === "number" && parsed.fingerprint
      ? parsed
      : null;
  } catch {
    return null;
  }
}

async function getJson(
  url: string,
  headers?: Record<string, string>,
): Promise<any> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// MusicBrainz requires ~1 req/s; serialize MB calls to avoid 503s.
let lastMbAt = 0;
async function mbGetJson(url: string): Promise<any> {
  const wait = lastMbAt + 1000 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastMbAt = Date.now();
  return getJson(url, { "User-Agent": MB_UA });
}

function artistCredit(credit?: Array<{ name?: string }>): string | undefined {
  const name = credit?.map((ac) => ac.name ?? "").join("");
  return name || undefined;
}

function parseYear(date?: string): number | undefined {
  const y = date?.slice(0, 4);
  return y && /^\d{4}$/.test(y) ? Number(y) : undefined;
}

function findTrack(
  recordingTitle: string | undefined,
  release: any,
): number | undefined {
  const target = recordingTitle?.toLowerCase();
  if (!target) return undefined;
  for (const medium of release?.media ?? []) {
    for (const track of medium?.tracks ?? []) {
      if (track?.title?.toLowerCase() === target) {
        return typeof track.position === "number" ? track.position : undefined;
      }
    }
  }
  return undefined;
}

function coverUrl(releaseId?: string): string | undefined {
  return releaseId
    ? `https://coverartarchive.org/release/${releaseId}/front`
    : undefined;
}

/**
 * Fingerprint the file with fpcalc, match against AcoustID, then pull rich
 * metadata (title/artist/album/albumArtist/track/year/genre/cover) from
 * MusicBrainz. Returns null (silently) on any failure so callers fall back to
 * local tags.
 */
export async function lookupByFingerprint(
  file: string,
): Promise<Partial<TrackMeta> | null> {
  const key = process.env.ACOUSTID_API_KEY;
  if (!key) return null;

  const fp = await runFpcalc(file);
  if (!fp) return null;

  try {
    const params = new URLSearchParams({
      client: key,
      duration: String(Math.round(fp.duration)),
      fingerprint: fp.fingerprint,
      meta: "recordings+releasegroups",
    });

    const acoustid = await getJson(
      `https://api.acoustid.org/v2/lookup?${params}`,
    );
    const recordingId: string | undefined =
      acoustid?.results?.[0]?.recordings?.[0]?.id;
    if (!recordingId) return null;

    const rec = await mbGetJson(
      `https://musicbrainz.org/ws/2/recording/${recordingId}?inc=artists+releases+release-groups+media&fmt=json`,
    );

    const release = rec?.releases?.[0];
    const artist = artistCredit(rec?.["artist-credit"]);

    let genre: string | undefined;
    const releaseGroupId: string | undefined = release?.["release-group"]?.id;
    if (releaseGroupId) {
      const rg = await mbGetJson(
        `https://musicbrainz.org/ws/2/release-group/${releaseGroupId}?inc=genres&fmt=json`,
      );
      genre = rg?.genres?.[0]?.name;
    }

    return {
      title: rec?.title,
      artist,
      album: release?.title,
      albumArtist: artistCredit(release?.["artist-credit"]) ?? artist,
      track: findTrack(rec?.title, release),
      year: parseYear(release?.date),
      genre,
      coverUrl: coverUrl(release?.id),
    };
  } catch {
    return null;
  }
}
