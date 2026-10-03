import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { copyFile, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { OperationResult, ProgressCallback, SyncAction, Tree } from "./types.js";
import { runWithProgress } from "./progress.js";

// Full recursive walk (all files, not just audio). Symlinks are skipped
async function walk(dir: string): Promise<Tree> {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const stack: Array<{ abs: string; rel: string }> = [{ abs: dir, rel: "" }];

  while (stack.length) {
    const { abs, rel } = stack.pop()!;
    const entries = await readdir(abs, { withFileTypes: true }).catch(
      () => null,
    );

    if (!entries) continue;

    for (const e of entries) {
      const childAbs = join(abs, e.name);
      const childRel = rel ? join(rel, e.name) : e.name;

      if (e.isDirectory()) {
        dirs.add(childRel);
        stack.push({ abs: childAbs, rel: childRel });
        continue;
      }

      if (e.isFile()) {
        files.set(childRel, childAbs);
      }
    }
  }

  return { files, dirs };
}

function fileHash(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(path);

    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

// Cheaper to check size first; only hash when sizes match
async function sameFile(a: string, b: string): Promise<boolean> {
  const [sa, sb] = await Promise.all([stat(a), stat(b)]);
  if (sa.size !== sb.size) return false;

  return (await fileHash(a)) === (await fileHash(b));
}

async function planSync(
  origin: string,
  dest: string,
  force: boolean,
): Promise<SyncAction[]> {
  const [srcTree, dstTree] = await Promise.all([walk(origin), walk(dest)]);
  const actions: SyncAction[] = [];

  for (const rel of [...srcTree.dirs].sort()) {
    if (!dstTree.dirs.has(rel)) actions.push({ kind: "mkdir", rel });
  }

  for (const [rel, src] of [...srcTree.files].sort()) {
    const dst = dstTree.files.get(rel);

    if (!dst) {
      actions.push({ kind: "copy", rel });
      continue;
    }

    if (!(await sameFile(src, dst))) {
      actions.push({ kind: "copy", rel });
    }
  }

  if (force) {
    for (const [rel] of [...dstTree.files].sort()) {
      if (!srcTree.files.has(rel)) {
        actions.push({ kind: "delete", rel });
      }
    }

    // Extra dirs, deepest-first; rm recursive clears their contents too
    const extraDirs = [...dstTree.dirs].filter((rel) => !srcTree.dirs.has(rel));
    for (const rel of extraDirs.sort((a, b) => b.length - a.length)) {
      actions.push({ kind: "delete", rel });
    }
  }

  return actions;
}

export async function runSync(
  origin: string,
  dest: string,
  opts: { force: boolean; dryRun: boolean },
  onProgress?: ProgressCallback,
): Promise<OperationResult> {
  const actions = await planSync(origin, dest, opts.force);

  if (opts.dryRun) {
    const plan = actions.map((a) => {
      if (a.kind === "mkdir") return `  MKDIR  ${a.rel}/`;
      if (a.kind === "copy") return `  COPY   ${a.rel}`;
      return `  DELETE ${a.rel}`;
    });

    return { ok: true, stats: { planned: actions.length }, errors: [], plan };
  }

  await mkdir(dest, { recursive: true });

  let copied = 0;
  let deleted = 0;

  for (const a of actions) {
    if (a.kind === "mkdir") await mkdir(join(dest, a.rel), { recursive: true });
  }

  const execItems = actions.filter((a) => a.kind !== "mkdir");

  await runWithProgress(
    execItems,
    async (a) => {
      if (a.kind === "copy") {
        const dst = join(dest, a.rel);
        await mkdir(dirname(dst), { recursive: true });
        await copyFile(join(origin, a.rel), dst);
        copied++;
        return;
      }

      await rm(join(dest, a.rel), { recursive: true, force: true });
      deleted++;
    },
    onProgress,
    (a) => a.rel,
  );

  return { ok: true, stats: { copied, deleted }, errors: [] };
}
