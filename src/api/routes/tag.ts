import { Router } from "express";
import { resolve } from "node:path";
import { tagFiles, previewTags } from "../../tagger.js";
import { startSSE } from "../sse.js";

const router = Router();

router.post("/", async (req, res) => {
  const { input, output, plan = false, overwrite = false, includeLyrics = false } = req.body as {
    input: string; output?: string; plan?: boolean; overwrite?: boolean; includeLyrics?: boolean;
  };

  if (!input || typeof input !== "string") {
    res.status(400).json({ error: "input is required" });
    return;
  }

  const { progress, end } = startSSE(res);

  try {
    const inputDir = resolve(input);
    const outDir = output ? resolve(output) : null;
    const result = plan
      ? await previewTags(inputDir, { overwrite }, progress)
      : await tagFiles(inputDir, outDir, { overwrite, includeLyrics }, progress);
    end({ result });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: "error", message: (err as Error).message })}\n\n`);
    res.end();
  }
});

export default router;
