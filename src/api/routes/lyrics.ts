import { Router } from "express";
import { resolve } from "node:path";
import { fetchLyricsForDir } from "../../core/lyrics.js";
import { startSSE } from "../sse.js";

const router = Router();

router.post("/", async (req, res) => {
  const { input, output, dryRun = false } = req.body as {
    input: string; output?: string; dryRun?: boolean;
  };

  if (!input || typeof input !== "string") {
    res.status(400).json({ error: "input is required" });
    return;
  }

  const { progress, end } = startSSE(res);

  try {
    const result = await fetchLyricsForDir(resolve(input), output ? resolve(output) : null, { dryRun }, progress);
    end({ result });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: "error", message: (err as Error).message })}\n\n`);
    res.end();
  }
});

export default router;
