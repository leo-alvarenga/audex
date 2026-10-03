import { Router } from "express";
import { readdir, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

const router = Router();

router.get("/browse", async (req, res) => {
  const { path: rawPath } = req.query as { path?: string };
  if (!rawPath || typeof rawPath !== "string") {
    res.status(400).json({ error: "path query parameter is required" });
    return;
  }

  const dirPath = resolve(rawPath);

  try {
    const info = await stat(dirPath);
    if (!info.isDirectory()) {
      res.status(400).json({ error: "path is not a directory" });
      return;
    }

    const entries = await readdir(dirPath, { withFileTypes: true });
    const dirs: string[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const absPath = join(dirPath, entry.name);
      // Verify it's a real directory (no symlink escape)
      try {
        const s = await stat(absPath);
        if (s.isDirectory()) dirs.push(absPath);
      } catch {
        // skip unreadable
      }
    }

    res.json({ current: dirPath, dirs });
  } catch {
    res.status(400).json({ error: "path does not exist or is not accessible" });
  }
});

export default router;
