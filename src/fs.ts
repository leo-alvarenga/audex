import { stat } from "node:fs/promises";

export async function assertDir(path: string, label: string): Promise<void> {
  const info = await stat(path).catch(() => null);

  if (!info) throw new Error(`${label} directory does not exist: ${path}`);

  if (!info.isDirectory()) throw new Error(`${label} path is not a directory: ${path}`);
}

export async function fileExists(path: string): Promise<boolean> {
  return Boolean(await stat(path).catch(() => null));
}
