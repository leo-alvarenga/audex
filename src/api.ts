import { createApp } from "./api/server.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const port = parseInt(process.env.PORT ?? "4242", 10);
const webDist = join(dirname(fileURLToPath(import.meta.url)), "..", "web", "dist");
const app = createApp(webDist);

app.listen(port, "127.0.0.1", () => {
  const url = `http://localhost:${port}`;
  console.log(`Audex web running at ${url}`);
  if (process.argv.includes("--open")) {
    // ponytail: "open" is an optional peer dep; no-op when it isn't installed
    import("open" as string)
      .then((mod) => (mod as { default: (url: string) => Promise<unknown> }).default(url))
      .catch(() => {});
  }
});
