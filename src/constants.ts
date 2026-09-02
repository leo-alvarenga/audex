import { readFileSync } from "node:fs";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

export const MB_UA = `audex/${pkg.version} (https://github.com/leo-alvarenga/audex)`;
