import { cpus } from "node:os";
import pLimit from "p-limit";
import cliProgress from "cli-progress";
import type { ProgressCallback } from "./types.js";

export async function runWithProgress<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  onProgress?: ProgressCallback,
  format?: (item: T) => string,
): Promise<void> {
  if (items.length === 0) return;

  const limit = pLimit(cpus().length);
  let done = 0;
  const total = items.length;

  await Promise.all(
    items.map((item) =>
      limit(async () => {
        await fn(item);
        done++;
        onProgress?.({ done, total, current: format ? format(item) : "" });
      }),
    ),
  );
}

export function cliProgressCallback(label: string): ProgressCallback {
  let bar: cliProgress.SingleBar | null = null;

  return ({ done, total, current }) => {
    if (!bar) {
      bar = new cliProgress.SingleBar(
        { format: `${label} [{bar}] {percentage}% | {value}/{total} | {file}` },
        cliProgress.Presets.shades_classic,
      );
      bar.start(total, 0);
    }
    bar.increment(1, { file: current });
    if (done === total) bar.stop();
  };
}
