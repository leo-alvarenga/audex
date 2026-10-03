import { Command } from "commander";
import { indexCommand } from "./index.js";
import { queryCommand } from "./query.js";
import { copyCommand } from "./copy.js";
import { organizeCommand } from "./organize.js";

export function libraryCommand(): Command {
  return new Command()
    .name("library")
    .description("Manage the local library index")
    .addCommand(indexCommand())
    .addCommand(queryCommand())
    .addCommand(copyCommand())
    .addCommand(organizeCommand());
}
