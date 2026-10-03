# Audex

A command-line tool (and optional web UI) for transcoding lossless audio and keeping your library organized. It converts FLAC files to AAC, fetches metadata from MusicBrainz, embeds cover art, grabs synced lyrics, and can sort everything into a tidy `Artist/Album/Track` folder layout.

## What it does

- **Convert** FLAC files to M4A (AAC 256kbps) while mirroring your folder structure. If a file can't be transcoded, Audex copies the original FLAC so nothing gets lost.
- **Tag** audio files (FLAC, M4A, MP3) by querying MusicBrainz and AcoustID, embedding cover art when available. Supports a dry-run preview (`--plan`) before touching anything.
- **Fetch lyrics** and write timestamped `.lrc` files next to your audio.
- **Sync** one directory into another, copying only what's missing or changed.
- **Index** your library into a local SQLite database, then query, copy, or organize tracks from it.
- **Web UI** — a browser interface that drives all of the above without the terminal, with live progress streaming.

## Requirements

- **Node.js** 18 or later
- **pnpm** (`npm i -g pnpm`)
- **ffmpeg** on your `PATH` (used by the converter and AcoustID fingerprinting)

## Install and build

```bash
git clone <repo-url> audex
cd audex
pnpm install
pnpm build          # compiles TypeScript → dist/
```

To also build the web UI:

```bash
pnpm build:web      # builds web/ → web/dist/
```

After building, link the CLI globally so you can run `audex` from anywhere:

```bash
npm link
```

Or run it without linking:

```bash
node dist/cli.js <command>
```

## Quick start

```bash
# Transcode a folder of FLACs to M4A
audex convert ~/music/flac ~/music/aac

# Tag the resulting files (dry-run first)
audex tag ~/music/aac --plan
audex tag ~/music/aac

# Index the library and organize it
audex library index ~/music/aac
audex library organize ~/music/aac ~/music/organized

# Start the web UI
audex web --open
```

## Documentation

| Doc | What's in it |
|-----|-------------|
| [CLI reference](docs/cli.md) | Every command, flag, and example |
| [Library system](docs/library.md) | How indexing, querying, organizing, and copying work |
| [Web UI and API](docs/web.md) | The browser interface and the HTTP API it uses |

## Running tests

```bash
pnpm test
```

Three smoke test scripts live in `test/`: general operations, sync behavior, and library operations.

## License

MIT
