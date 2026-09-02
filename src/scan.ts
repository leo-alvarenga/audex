import { readdir } from "node:fs/promises";
import { extname, join } from "node:path";

export async function scanFiles(
  dir: string,
  extensions: string[],
): Promise<string[]> {
  const exts = new Set(extensions.map((e) => e.toLowerCase()));
  const stack = [dir];
  const out: string[] = [];

  while (stack.length) {
    const current = stack.pop()!;
    const entries = await readdir(current, { withFileTypes: true }).catch(
      () => null,
    );

    if (!entries) continue;

    for (const e of entries) {
      const full = join(current, e.name);

      if (e.isDirectory()) {
        stack.push(full);
        continue;
      }

      if (e.isFile() && exts.has(extname(e.name).toLowerCase())) {
        out.push(full);
      }
    }
  }

  return out.sort();
}
