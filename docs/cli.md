# CLI Reference

All commands follow the same shape:

```
audex <command> [arguments] [options]
```

Run `audex --help` or `audex <command> --help` at any time to see usage inline.

---

## convert

```
audex convert <input> <output> [options]
```

Scans `input` for `.flac` files and transcodes each one to AAC (256kbps, 44.1kHz, stereo) as `.m4a`, writing results into `output` with the same folder structure. The output directory must already exist.

If a file fails to convert, Audex copies the original FLAC instead of skipping it — you won't silently lose anything.

**Options**

| Flag | Description |
|------|-------------|
| `--include-lyrics` | Fetch synced lyrics and write `.lrc` files next to each output file |
| `--auto-tag` | Run auto-tagging (MusicBrainz/AcoustID) on each file after converting |
| `--dry-run` | Show what would be done without touching any files |

**Examples**

```bash
# Basic conversion
audex convert ~/music/flac ~/music/aac

# Convert and fetch lyrics at the same time
audex convert ~/music/flac ~/music/aac --include-lyrics

# Preview without writing anything
audex convert ~/music/flac ~/music/aac --dry-run
```

After it finishes, Audex prints a summary:

```
Done: 42 converted, 0 copied (conversion failed), 3 skipped (already exist).
```

---

## tag

```
audex tag <input> [output] [options]
```

Tags audio files (`.flac`, `.m4a`, `.mp3`) by reading existing metadata, querying MusicBrainz/AcoustID for missing fields, and embedding cover art when available.

- Without an `output` dir, files are edited in place — Audex will ask you to confirm before doing anything.
- With an `output` dir, tagged copies are written there, mirroring the folder structure. The originals are untouched.

Existing tags take precedence by default. Use `--overwrite` to let the fetched data win instead.

**Options**

| Flag | Description |
|------|-------------|
| `--plan` | Dry-run: show what would be tagged without writing anything |
| `--overwrite` | Prefer fetched metadata over existing tags |
| `--include-lyrics` | Also write `.lrc` files next to each tagged file |

**Examples**

```bash
# Preview before committing
audex tag ~/music/aac --plan

# Tag in place (will prompt for confirmation)
audex tag ~/music/aac

# Tag into a separate directory
audex tag ~/music/aac ~/music/tagged

# Overwrite existing tags with whatever MusicBrainz returns
audex tag ~/music/aac --overwrite

# Tag and include lyrics in one pass
audex tag ~/music/aac ~/music/tagged --include-lyrics
```

After tagging, Audex prints a breakdown:

```
Done: 42 file(s) tagged in place.
  complete successes: 38
  missing cover art: 2
  missing metadata: 2
```

---

## lyrics

```
audex lyrics <input> [output] [options]
```

Scans `input` for audio files and fetches timestamped `.lrc` lyrics for each one. By default, `.lrc` files are written next to the audio files. Pass `output` to write them somewhere else instead, preserving the folder structure.

Files that already have an `.lrc` next to them are skipped unless you force it.

**Examples**

```bash
# Write .lrc files next to the audio
audex lyrics ~/music/aac

# Write .lrc files into a separate folder
audex lyrics ~/music/aac ~/music/lyrics
```

---

## sync

```
audex sync <origin> <dest> [options]
```

Mirrors `origin` into `dest`, copying only files that are missing or different. Useful for keeping a backup or a device in sync with your library.

**Options**

| Flag | Description |
|------|-------------|
| `--dry-run` | Show what would be copied without doing it |
| `--force` | Copy files even if they already exist in `dest` |

**Examples**

```bash
# Sync to a backup drive
audex sync ~/music/aac /mnt/backup/music

# See what would change first
audex sync ~/music/aac /mnt/backup/music --dry-run

# Force re-copy everything
audex sync ~/music/aac /mnt/backup/music --force
```

---

## library

The `library` command groups four sub-commands for managing a local SQLite index of your audio files. The database lives at `~/.audex/library.db` and is shared across all your libraries.

### library index

```
audex library index <input> [options]
```

Scans `input` for audio files and upserts their metadata into the local library. On subsequent runs it skips files whose size and modification time haven't changed, so re-indexing a large library is fast.

| Flag | Description |
|------|-------------|
| `--force` | Re-index every file even if nothing appears to have changed |

```bash
audex library index ~/music/aac
# → Indexed 42 file(s), skipped 0 unchanged, removed 0 stale.
```

### library query

```
audex library query [pattern] [options]
```

Searches the index. The pattern can be free text, a field filter, or `*` to return everything.

**Pattern syntax**

| Pattern | Matches |
|---------|---------|
| `*` | All tracks |
| `radiohead` | Tracks where title, artist, or album contains "radiohead" |
| `artist:Radiohead` | Tracks where artist is exactly "Radiohead" |
| `album:"OK Computer"` | Tracks where album is exactly "OK Computer" |
| `artist:Radiohead album:"OK Computer"` | Both filters combined |

Supported field names: `artist`, `album`, `albumArtist`, `album_artist`, `title`, `year`, `genre`.

| Flag | Description |
|------|-------------|
| `--limit <n>` | Max results to return (default: 50) |
| `--library <path>` | Filter to tracks from a specific library root |

```bash
audex library query "artist:Radiohead"
audex library query "OK Computer" --limit 10
audex library query "*" --library ~/music/aac
```

### library copy

```
audex library copy <output> [pattern] [options]
```

Queries the index with `pattern` and copies matched tracks to `output`, preserving paths relative to their library root. The output directory is created if it doesn't exist.

| Flag | Description |
|------|-------------|
| `--library <path>` | Filter to tracks from a specific library root |
| `--force` | Overwrite files that already exist in `output` |

```bash
# Copy all Radiohead tracks to a folder
audex library copy ~/export "artist:Radiohead"

# Copy the entire library
audex library copy ~/export "*"
```

### library organize

```
audex library organize <input> [output] [options]
```

Rearranges audio files into an `Artist/Album/NN. Title.ext` folder layout based on their tags. Without an `output` dir, files are moved in place inside `input`. With `output`, they're moved (or copied) there.

| Flag | Description |
|------|-------------|
| `--copy` | Copy files instead of moving them |
| `--force` | Overwrite existing files at the destination |
| `--force-index` | Re-index the library before organizing, even if it's already known |

```bash
# Organize in place
audex library organize ~/music/aac

# Organize into a new folder (move)
audex library organize ~/music/aac ~/music/organized

# Organize into a new folder (copy, keep originals)
audex library organize ~/music/aac ~/music/organized --copy
```

---

## web

```
audex web [options]
```

Starts the Audex web UI, which gives you a browser-based interface for all the commands above. Both the API and the React frontend are served from the same process.

| Flag | Description |
|------|-------------|
| `--port <number>` | Port to listen on (default: 4242) |
| `--open` | Open the browser automatically after starting |

```bash
audex web
# → Audex web running at http://localhost:4242

audex web --port 8080 --open
```

The web UI requires that `web/dist/` exists. If you haven't built it yet, run `pnpm build:web` first.
