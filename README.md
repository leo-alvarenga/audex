# audex

Converts FLAC files to AAC `.m4a` so they fit on my DAP, and tags audio files.
That's basically it.

## What it does

- `audex convert`: scans a folder for `.flac` files, transcodes each to AAC
  (256kbps, 44.1kHz, stereo) as `.m4a`, and mirrors the folder structure into
  an output directory. If a file fails to convert, it copies the original
  FLAC instead of losing it.
- `audex tag`: tags audio files (`.flac`, `.m4a`, `.mp3`) using existing
  metadata, with an optional review step.
- `audex sync`: mirrors a directory into another (same structure and files),
  copying only what's missing or different, with `--dry-run` and `--force`.

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

### convert

```bash
audex convert <input-dir> <output-dir> [--dry-run] [--auto-tag] [--include-lyrics]
```

The output dir must already exist.

```bash
# Convert everything
audex convert ~/music/flac ~/music/dap

# Preview what would happen without writing anything
audex convert ~/music/flac ~/music/dap --dry-run
```

`--auto-tag` tries to fetch missing metadata from MusicBrainz/AcoustID. It's
flaky; treat it as a bonus, not a guarantee.

`--include-lyrics` fetches timestamped lyrics from LRCLIB and writes a
`.lrc` file next to each output file (name matches the audio file). Tracks
without available lyrics are skipped and counted in a warning at the end.
### tag

```bash
audex tag <input-dir> [output-dir] [--plan] [--overwrite] [--include-lyrics]
```

Without an output dir, files are edited in place (you'll be asked to confirm).
With an output dir, tagged copies are written there, mirroring the structure.

The default action always queries MusicBrainz/AcoustID and embeds album art
when it's available. `--overwrite` prefers the fetched data over the file's
existing tags; otherwise existing tags take precedence and remote data only
fills gaps.

`--plan` generates a reviewable plan file (`audex-plan.json` in the input
dir) instead of tagging. It includes the resolved tags plus the album-art
URL (no art is embedded at this stage). Edit it, then run
`audex tag <input-dir>` again to apply it. Pass `--overwrite` to `--plan` to
plan the overwrite-flavored tags (fetched data over existing):

```bash
# See what the tagger would do, and review/edit it
audex tag ~/music/flac --plan

# Apply the (edited) plan to copies
audex tag ~/music/flac ~/music/dap --overwrite
```

`--include-lyrics` (same as convert) also writes `.lrc` files next to each
tagged file.

### sync

```bash
audex sync <origin> <dest> [--dry-run] [--force]
```

Mirrors `<origin>` into `<dest>`: creates missing directories, copies missing
or changed files (compared by size, then SHA-256). `--force` also deletes files
and directories in `<dest>` that are not in `<origin>`. `--dry-run` prints what
would change without writing anything.

## Heads up

This is a proof of concept. I wrote it to scratch my own itch while getting
into the hobby, and it won't get much attention or polish. It works for my
library, on my machine. YMMV.
