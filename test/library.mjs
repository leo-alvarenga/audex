import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = new URL("../dist/cli.js", import.meta.url).pathname;

function audex(args, env = {}) {
  return execFileSync(process.execPath, [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
}

function audexMayFail(args, env = {}) {
  try {
    return { stdout: audex(args, env), status: 0 };
  } catch (err) {
    return { stdout: err.stdout ?? "", status: err.status ?? 1 };
  }
}

test("library: index, query, copy, skip, force", () => {
  const tmp = mkdtempSync(join(tmpdir(), "audex-lib-"));
  const home = join(tmp, "home");
  const musicDir = join(tmp, "music", "Artist", "Album");
  const outDir = join(tmp, "out");

  mkdirSync(home, { recursive: true });
  mkdirSync(musicDir, { recursive: true });

  // fake audio files — parseFile failures are swallowed, rows upsert with null metadata
  writeFileSync(join(musicDir, "01.flac"), "fake");
  writeFileSync(join(musicDir, "02.mp3"), "fake");

  const env = { HOME: home };

  // index
  const indexOut = audex(["library", "index", join(tmp, "music")], env);
  assert.match(indexOut, /Indexed 2/);

  // query lists both
  const queryOut = audex(["library", "query", "*"], env);
  assert.match(queryOut, /01\.flac/);
  assert.match(queryOut, /02\.mp3/);

  // copy mirrors tree
  audex(["library", "copy", outDir], env);
  statSync(join(outDir, "Artist", "Album", "01.flac"));
  statSync(join(outDir, "Artist", "Album", "02.mp3"));

  // second copy — skipped, mtimeMs unchanged
  const mtime1 = statSync(join(outDir, "Artist", "Album", "01.flac")).mtimeMs;
  const copyOut2 = audex(["library", "copy", outDir], env);
  assert.match(copyOut2, /skipped/);
  const mtime2 = statSync(join(outDir, "Artist", "Album", "01.flac")).mtimeMs;
  assert.equal(mtime1, mtime2);

  // --force rewrites — mtimeMs changes
  // small sleep to guarantee mtime differs on fast filesystems
  const before = Date.now();
  while (Date.now() - before < 10) { /* spin */ }
  audex(["library", "copy", outDir, "--force"], env);
  const mtime3 = statSync(join(outDir, "Artist", "Album", "01.flac")).mtimeMs;
  assert.notEqual(mtime2, mtime3);

  // bare `audex index` must exit non-zero (command removed from top level)
  const { status } = audexMayFail(["index", join(tmp, "music")], env);
  assert.notEqual(status, 0);

  rmSync(tmp, { recursive: true, force: true });
});
