import { Command } from "commander";

export function webCommand(): Command {
  return new Command()
    .name("web")
    .description("Start the Audex web UI")
    .option("--port <number>", "port to listen on", "4242")
    .option("--open", "open browser after start")
    .action(async (opts: { port: string; open: boolean }) => {
      process.env.PORT = opts.port;
      if (opts.open) process.argv.push("--open");
      await import("../api.js");
    });
}
