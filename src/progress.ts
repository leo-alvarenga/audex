import { cpus } from "node:os";
import pLimit from "p-limit";
import cliProgress from "cli-progress";

// Run `fn` over `items` with CPU-bound concurrency and a single progress bar
export async function runWithProgress(
  label: string,
  items: string[],
  format: (item: string) => string,
  fn: (item: string) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;

  const limit = pLimit(cpus().length);

  const bar = new cliProgress.SingleBar(
    { format: `${label} [{bar}] {percentage}% | {value}/{total} | {file}` },
    cliProgress.Presets.shades_classic,
  );

  bar.start(items.length, 0);

  await Promise.all(
    items.map((item) =>
      limit(async () => {
        try {
          await fn(item);
        } finally {
          bar.increment(1, { file: format(item) });
        }
      }),
    ),
  );

  bar.stop();
}
