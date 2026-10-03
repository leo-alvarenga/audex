import { Router } from "express";
import { resolve } from "node:path";
import { runSync } from "../../sync.js";
import { startSSE } from "../sse.js";

const router = Router();

router.post("/", async (req, res) => {
  const { origin, dest, dryRun = false, force = false } = req.body as {
    origin: string; dest: string; dryRun?: boolean; force?: boolean;
  };

  if (!origin || !dest || typeof origin !== "string" || typeof dest !== "string") {
    res.status(400).json({ error: "origin and dest are required strings" });
    return;
  }

  const { progress, end } = startSSE(res);

  try {
    const result = await runSync(resolve(origin), resolve(dest), { dryRun, force }, progress);
    end({ result });
  } catch (err) {
    res.write(`data: ${JSON.stringify({ type: "error", message: (err as Error).message })}\n\n`);
    res.end();
  }
});

export default router;
