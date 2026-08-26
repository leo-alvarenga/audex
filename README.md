# audex

Converts FLAC files to AAC `.m4a` so they fit on my DAP. That's basically it.

## What it does

- Scans a folder for `.flac` files
- Transcodes each one to AAC (256kbps, 44.1kHz, stereo) as `.m4a`
- Mirrors the folder structure into your output directory
- If a file fails to convert, it copies the original FLAC instead of losing it

## Requirements

- [ffmpeg](https://ffmpeg.org/) on your PATH
- Node.js 18+

## Install & build

```bash
npm install
npm run build

alias audex="node $(pwd)/dist/cli.js" # or whatever way you want to run it
```

## Usage

```bash
audex <input-dir> <output-dir>
```

The output dir must already exist. Examples:

```bash
# Convert everything
audex ~/music/flac ~/music/dap

# Preview what would happen without writing anything
audex ~/music/flac ~/music/dap --dry-run
```

There's also a `--auto-tag` flag that tries to fetch missing metadata from MusicBrainz/AcoustID. It's flaky — treat it as a bonus, not a guarantee.

## Heads up

This is a proof of concept. I wrote it to scratch my own itch while getting into the hobby, and it won't get much attention or polish. It works for my library, on my machine. YMMV.
