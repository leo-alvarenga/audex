import express from "express";
import { join } from "node:path";
import convertRoute from "./routes/convert.js";
import syncRoute from "./routes/sync.js";
import tagRoute from "./routes/tag.js";
import lyricsRoute from "./routes/lyrics.js";
import libraryRoute from "./routes/library.js";
import fsRoute from "./routes/fs.js";

export function createApp(webDistPath: string) {
  const app = express();
  app.use(express.json());

  app.use("/api/convert", convertRoute);
  app.use("/api/sync", syncRoute);
  app.use("/api/tag", tagRoute);
  app.use("/api/lyrics", lyricsRoute);
  app.use("/api/library", libraryRoute);
  app.use("/api/fs", fsRoute);

  app.use(express.static(webDistPath));
  // ponytail: middleware instead of app.get("*") — Express 5 rejects bare "*" paths
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api/")) {
      next();
      return;
    }
    res.sendFile(join(webDistPath, "index.html"));
  });

  return app;
}
