import { Router } from "express";
import { resolve } from "node:path";
import { convert } from "../../convert.js";
import { startSSE } from "../sse.js";

const router = Router();

router.post("/", async (req, res) => {
  const { input, output, autoTag = false, dryRun = false, includeLyrics = false } = req.body as {
    input: string; output: string; autoTag?: boolean; dryRun?: boolean; includeLyrics?: boolean;
  };

  if (!input || !output || typeof input !== "string" || typeof output !== "string") {
    res.status(400).json({ error: "input and output are required strings" });
    return;
  }

  const { progress, end } = startSSE(res);

  try {
    const result = await convert(resolve(input), resolve(output), { autoTag, dryRun, includeLyrics }, progress);
    end({ result });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: "error", message: (err as Error).message })}\n\n`);
    res.end();
  }
});

export default router;
