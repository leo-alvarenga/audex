import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSync } from "../dist/sync.js";
import { lrcPath, writeLyrics } from "../dist/lyrics.js";

// Minimal valid 8-bit mono WAV so music-metadata can parse it without ffmpeg.
function writeTinyWav(path) {
  const sampleRate = 8000;
  const dataSize = 1;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate, 28); // byte rate (8-bit mono)
  header.writeUInt16LE(1, 32); // block align
  header.writeUInt16LE(8, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  writeFileSync(path, Buffer.concat([header, Buffer.alloc(dataSize)]));
}

test("sync: copies missing, skips equal, overwrites changed", async () => {
  const root = mkdtempSync(join(tmpdir(), "audex-sync-"));
  try {
    const origin = join(root, "origin");
    const dest = join(root, "dest");
    mkdirSync(join(origin, "sub"), { recursive: true });
    writeFileSync(join(origin, "a.txt"), "same");
    writeFileSync(join(origin, "sub", "b.txt"), "origin-content");
    mkdirSync(dest, { recursive: true });
    mkdirSync(join(dest, "sub"), { recursive: true });
    writeFileSync(join(dest, "a.txt"), "same");
    writeFileSync(join(dest, "sub", "b.txt"), "stale");

    await runSync(origin, dest, { force: false, dryRun: false });

    assert.equal(readFileSync(join(dest, "a.txt"), "utf8"), "same");
    assert.equal(
      readFileSync(join(dest, "sub", "b.txt"), "utf8"),
      "origin-content",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("sync: --force deletes files/dirs not in origin", async () => {
  const root = mkdtempSync(join(tmpdir(), "audex-sync-"));
  try {
    const origin = join(root, "origin");
    const dest = join(root, "dest");
    mkdirSync(origin, { recursive: true });
    writeFileSync(join(origin, "keep.txt"), "x");
    mkdirSync(join(dest, "extra"), { recursive: true });
    writeFileSync(join(dest, "extra", "stale.txt"), "x");
    writeFileSync(join(dest, "keep.txt"), "x");

    await runSync(origin, dest, { force: true, dryRun: false });

    assert.ok(!existsSync(join(dest, "extra")));
    assert.ok(existsSync(join(dest, "keep.txt")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("sync: --dry-run makes no changes", async () => {
  const root = mkdtempSync(join(tmpdir(), "audex-sync-"));
  try {
    const origin = join(root, "origin");
    const dest = join(root, "dest");
    mkdirSync(origin, { recursive: true });
    writeFileSync(join(origin, "new.txt"), "x");
    mkdirSync(dest, { recursive: true });

    await runSync(origin, dest, { force: false, dryRun: true });

    assert.ok(!existsSync(join(dest, "new.txt")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("lrcPath: strips extension, preserves dotted names", () => {
  assert.equal(lrcPath("/Music/SongTitle.flac"), "/Music/SongTitle.lrc");
  assert.equal(lrcPath("/Music/My.Song.m4a"), "/Music/My.Song.lrc");
});

test("writeLyrics: writes .lrc next to audio when lyrics found", async () => {
  const root = mkdtempSync(join(tmpdir(), "audex-lyr-"));
  try {
    const audio = join(root, "My.Song.wav");
    writeTinyWav(audio);
    const fakeFetch = async () => ({
      ok: true,
      json: async () => ({ syncedLyrics: "[00:01.00] hello" }),
    });

    const ok = await writeLyrics(
      audio,
      audio,
      { artist: "A", title: "T" },
      fakeFetch,
    );

    assert.equal(ok, true);
    assert.equal(
      readFileSync(join(root, "My.Song.lrc"), "utf8"),
      "[00:01.00] hello",
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("writeLyrics: returns false when no lyrics available", async () => {
  const root = mkdtempSync(join(tmpdir(), "audex-lyr-"));
  try {
    const audio = join(root, "song.wav");
    writeTinyWav(audio);
    const fakeFetch = async () => ({ ok: false, json: async () => ({}) });

    const ok = await writeLyrics(
      audio,
      audio,
      { artist: "A", title: "T" },
      fakeFetch,
    );

    assert.equal(ok, false);
    assert.ok(!existsSync(join(root, "song.lrc")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

console.log("sync/lyrics tests passed");
