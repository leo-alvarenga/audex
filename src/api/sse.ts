import type { Response } from "express";
import type { ProgressCallback } from "../types.js";

export function startSSE(res: Response): { progress: ProgressCallback; end: (data: object) => void } {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const progress: ProgressCallback = (event) => {
    res.write(`data: ${JSON.stringify({ type: "progress", ...event })}\n\n`);
  };

  const end = (data: object) => {
    res.write(`data: ${JSON.stringify({ type: "done", ...data })}\n\n`);
    res.end();
  };

  return { progress, end };
}
