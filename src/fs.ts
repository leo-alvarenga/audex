import { stat } from "node:fs/promises";

export async function assertDir(path: string, label: string): Promise<void> {
  const info = await stat(path).catch(() => null);

  if (!info) {
    console.error(`error: ${label} directory does not exist: ${path}`);
    process.exit(1);
  }

  if (!info.isDirectory()) {
    console.error(`error: ${label} path is not a directory: ${path}`);
    process.exit(1);
  }
}

export async function fileExists(path: string): Promise<boolean> {
  return Boolean(await stat(path).catch(() => null));
}
