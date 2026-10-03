import { resolve } from "node:path";
import { Command } from "commander";
import { openLibrary, queryTracks } from "../library.js";
import type { LibraryTrack } from "../library.js";

function detailLine(t: LibraryTrack): string {
  const album = t.album ?? "";
  const year = t.year ? ` (${t.year})` : "";
  const albumPart = `${album}${year}`.trim();
  const track = t.track ? `  [track ${t.track}]` : "";

  const parts = [t.artist, albumPart].filter(Boolean).join(" — ");

  return `  ${parts}${track}`.trimEnd();
}

export function queryCommand(): Command {
  return new Command()
    .name("query")
    .description("Search the local library index")
    .argument(
      "[pattern]",
      "search pattern (e.g. artist:Radiohead, album:\"OK Computer\", free text, or * for all)",
    )
    .option("--limit <n>", "max results", (v) => parseInt(v, 10), 50)
    .option("--library <path>", "filter by library root")
    .action((pattern: string = "*", opts: { limit: number; library?: string }) => {
      const db = openLibrary();
      const results = queryTracks(db, pattern, opts.library ? resolve(opts.library) : undefined);
      db.close();

      if (results.length === 0) {
        console.log("No tracks found.");
        return;
      }

      for (const t of results.slice(0, opts.limit)) {
        console.log(t.path);
        const detail = detailLine(t);
        if (detail.trim()) console.log(detail);
        if (t.title) console.log(`  ${t.title}`);
      }

      console.log(`${results.length} result(s).`);
    });
}
