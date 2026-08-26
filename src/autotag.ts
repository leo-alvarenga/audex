import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { FpcalcResult, TrackMeta } from "./types.js";

const execFileP = promisify(execFile);

const MB_UA = "audex/0.1.0 (https://github.com/leo-alvarenga/audex)";

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

/**
 * Fingerprint the file with fpcalc, match against AcoustID, then pull the
 * recording's title/artist/album from MusicBrainz; Returns null (silently) on
 * any failure so the caller can fall back to local tags
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
    const mbid: string | undefined =
      acoustid?.results?.[0]?.recordings?.[0]?.id;

    if (!mbid) return null;

    const mb = await getJson(
      `https://musicbrainz.org/ws/2/recording/${mbid}?inc=artists+releases&fmt=json`,
      { "User-Agent": MB_UA },
    );

    const artist =
      mb?.["artist-credit"]
        ?.map((ac: { name?: string }) => ac.name ?? "")
        .join("") || mb?.["artist-credit"]?.[0]?.artist?.name;

    return {
      title: mb?.title,
      artist,
      album: mb?.releases?.[0]?.title,
    };
  } catch {
    return null;
  }
}
