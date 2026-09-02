import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { destPath } from "../dist/convert.js";
import { transcode } from "../dist/transcode.js";
import { scanFiles } from "../dist/scan.js";
import { writeTags } from "../dist/tagger.js";

const has = (cmd) => {
  try {
    execFileSync(cmd, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};
const e2e = has("ffmpeg") && has("ffprobe");

function tags(path) {
  return execFileSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format_tags",
      "-of",
      "default=noprint_wrappers=1",
      path,
    ],
    { encoding: "utf8" },
  );
}

test("destPath: preserves folder structure and swaps .flac -> .m4a", () => {
  assert.equal(
    destPath("/in", "/out", "/in/Artist/Album/01 - Song.flac"),
    "/out/Artist/Album/01 - Song.m4a",
  );
});

test("destPath: case-insensitive .FLAC extension", () => {
  assert.equal(destPath("/in", "/out", "/in/Track.FLAC"), "/out/Track.m4a");
});

test("destPath: nested and dotted names", () => {
  assert.equal(
    destPath("/in", "/out", "/in/a.b/c.d/My.Song.flac"),
    "/out/a.b/c.d/My.Song.m4a",
  );
});

test("transcode: copies source tags to m4a", { skip: !e2e }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "audex-"));
  try {
    const src = join(dir, "song.flac");
    const dest = join(dir, "song.m4a");
    execFileSync(
      "ffmpeg",
      [
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=1",
        "-metadata",
        "title=Copy Song",
        "-metadata",
        "artist=Copy Artist",
        "-c:a",
        "flac",
        src,
        "-y",
      ],
      { stdio: "ignore" },
    );
    await transcode(src, dest);
    const t = tags(dest);
    assert.match(t, /title=Copy Song/);
    assert.match(t, /artist=Copy Artist/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test(
  "transcode: writes resolved (auto-tag) metadata",
  { skip: !e2e },
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "audex-"));
    try {
      const src = join(dir, "bare.flac");
      const dest = join(dir, "bare.m4a");
      execFileSync(
        "ffmpeg",
        [
          "-f",
          "lavfi",
          "-i",
          "sine=frequency=440:duration=1",
          "-c:a",
          "flac",
          src,
          "-y",
        ],
        { stdio: "ignore" },
      );
      await transcode(src, dest, {
        title: "Overlay Song",
        artist: "Overlay Artist",
        album: "Overlay Album",
        track: 3,
      });
      const t = tags(dest);
      assert.match(t, /title=Overlay Song/);
      assert.match(t, /artist=Overlay Artist/);
      assert.match(t, /album=Overlay Album/);
      assert.match(t, /track=3/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

test("scanFiles: recursive, case-insensitive, filters by extension", async () => {
  const dir = mkdtempSync(join(tmpdir(), "audex-"));
  try {
    mkdirSync(join(dir, "sub"), { recursive: true });
    writeFileSync(join(dir, "a.flac"), "x");
    writeFileSync(join(dir, "sub", "b.FLAC"), "x");
    writeFileSync(join(dir, "sub", "c.mp3"), "x");
    writeFileSync(join(dir, "sub", "d.txt"), "x");
    const got = await scanFiles(dir, [".flac", ".mp3"]);
    assert.deepEqual(got, [join(dir, "a.flac"), join(dir, "sub", "b.FLAC"), join(dir, "sub", "c.mp3")]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("writeTags: embeds a local cover image", { skip: !e2e }, async () => {
  const dir = mkdtempSync(join(tmpdir(), "audex-"));
  try {
    const src = join(dir, "song.flac");
    const dest = join(dir, "out.flac");
    const cover = join(dir, "cover.jpg");
    execFileSync("ffmpeg", ["-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:a", "flac", src, "-y"], { stdio: "ignore" });
    execFileSync("ffmpeg", ["-f", "lavfi", "-i", "color=red:s=16x16", "-frames:v", "1", cover, "-y"], { stdio: "ignore" });
    await writeTags(src, dest, { title: "X", coverUrl: cover }, { overwrite: false });
    const out = execFileSync("ffprobe", ["-v", "error", "-show_streams", dest], { encoding: "utf8" });
    assert.match(out, /attached_pic=1/);
    assert.match(out, /codec_type=video/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

console.log("smoke tests passed");
