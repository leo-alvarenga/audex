import { Router } from "express";
import { resolve } from "node:path";
import { startSSE } from "../sse.js";
import { indexLibrary } from "../../core/index.js";
import { copyTracks } from "../../core/copy.js";
import { organizeLibrary } from "../../core/organize.js";
import { openLibrary, queryTracks } from "../../library.js";

const router = Router();

router.post("/index", async (req, res) => {
  const { input, force = false } = req.body as { input: string; force?: boolean };
  if (!input || typeof input !== "string") { res.status(400).json({ error: "input is required" }); return; }
  const { progress, end } = startSSE(res);
  try {
    const result = await indexLibrary(resolve(input), { force }, progress);
    end({ result });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: "error", message: (err as Error).message })}\n\n`);
    res.end();
  }
});

router.get("/query", (req, res) => {
  const { pattern = "*", library, limit = "50" } = req.query as { pattern?: string; library?: string; limit?: string };
  try {
    const db = openLibrary();
    const tracks = queryTracks(db, pattern, library ? resolve(library) : undefined);
    db.close();
    res.json({ tracks: tracks.slice(0, parseInt(limit, 10)) });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.post("/copy", async (req, res) => {
  const { output, pattern = "*", library, force = false } = req.body as {
    output: string; pattern?: string; library?: string; force?: boolean;
  };
  if (!output || typeof output !== "string") { res.status(400).json({ error: "output is required" }); return; }
  const { progress, end } = startSSE(res);
  try {
    const result = await copyTracks(pattern, resolve(output), { library: library ? resolve(library) : undefined, force }, progress);
    end({ result });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: "error", message: (err as Error).message })}\n\n`);
    res.end();
  }
});

router.post("/organize", async (req, res) => {
  const { input, output, copy = false, forceIndex = false, force = false } = req.body as {
    input: string; output?: string; copy?: boolean; forceIndex?: boolean; force?: boolean;
  };
  if (!input || typeof input !== "string") { res.status(400).json({ error: "input is required" }); return; }
  const { progress, end } = startSSE(res);
  try {
    const result = await organizeLibrary(resolve(input), output ? resolve(output) : null, { copy, forceIndex, force }, progress);
    end({ result });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: "error", message: (err as Error).message })}\n\n`);
    res.end();
  }
});

export default router;
