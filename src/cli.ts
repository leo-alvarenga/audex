#!/usr/bin/env node
import { Command } from "commander";
import { convertCommand } from "./commands/convert.js";
import { tagCommand } from "./commands/tag.js";
import { syncCommand } from "./commands/sync.js";
import { lyricsCommand } from "./commands/lyrics.js";
import { libraryCommand } from "./commands/library.js";
import { webCommand } from "./commands/web.js";

const program = new Command();

program
  .name("audex")
  .description("Automated lossless audio transcoding and tag management")
  .version("0.1.0");

program.addCommand(convertCommand());
program.addCommand(tagCommand());
program.addCommand(syncCommand());
program.addCommand(lyricsCommand());
program.addCommand(libraryCommand());
program.addCommand(webCommand());

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
