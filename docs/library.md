# Library System

Audex maintains a local SQLite database at `~/.audex/library.db`. It stores metadata for every audio file you've indexed, so you can search, copy, and reorganize your collection without scanning the filesystem every time.

## How indexing works

When you run `audex library index <dir>`, Audex:

1. Walks the directory recursively and collects all audio files (`.flac`, `.m4a`, `.mp3`).
2. For each file, checks if the stored `mtime` and `file_size` match what's on disk. If they match, the file is skipped — the metadata hasn't changed.
3. If the file is new or changed, it reads the tags with `music-metadata` and upserts the record into the `tracks` table.
4. At the end, it removes ("prunes") any rows whose paths no longer exist on disk.

The result: re-indexing a large library that hasn't changed is nearly instant.

Use `--force` to skip the mtime/size check and re-read every file regardless.

## Database schema

The database has two tables.

**tracks** — one row per audio file:

| Column | Type | Notes |
|--------|------|-------|
| `path` | TEXT (PK) | Absolute path to the file |
| `artist` | TEXT | Track artist |
| `album` | TEXT | Album name |
| `album_artist` | TEXT | Album artist (may differ from track artist) |
| `title` | TEXT | Track title |
| `track` | INTEGER | Track number |
| `year` | INTEGER | Release year |
| `genre` | TEXT | Genre |
| `duration` | REAL | Duration in seconds |
| `file_size` | INTEGER | File size in bytes |
| `mtime` | INTEGER | Last-modified timestamp (ms) |
| `indexed_at` | INTEGER | Unix timestamp of when it was indexed |
| `library_root` | TEXT | The root directory this track was indexed from |

**libraries** — one row per indexed root directory:

| Column | Type | Notes |
|--------|------|-------|
| `root` | TEXT (PK) | Absolute path of the root dir |
| `created_at` | INTEGER | Unix timestamp |

## Querying

`audex library query` accepts a flexible pattern language:

- `*` — return everything
- Free text like `ok computer` — matches title, artist, or album (case-insensitive `LIKE`)
- `field:value` — exact match on a specific field
- Multiple filters are ANDed together: `artist:Radiohead album:"OK Computer"`
- Quoted values let you match phrases with spaces: `album:"The Bends"`

Supported field names: `artist`, `album`, `albumArtist` (or `album_artist`), `title`, `year`, `genre`.

The `--library <path>` option narrows results to tracks indexed from a specific root directory. Useful when you have several separate libraries in the same database.

## Organizing your library

`audex library organize` moves (or copies) files into a clean folder structure:

```
Artist/
  Album/
    01. Track Title.flac
    02. Another Track.flac
```

The folder names are derived from the file's tags. Unknown values fall back to `Unknown Artist` or `Unknown Album`. Characters that aren't safe in filenames (`/ \ : * ? " < > |`) are replaced with `_`.

If a file would end up at the same path it started at, it's left alone.

The command auto-indexes the input directory before organizing, so you don't have to run `library index` first. Use `--force-index` to force a full re-index even if Audex already knows about that library root.

## Copying indexed tracks

`audex library copy <output> [pattern]` queries the index with the same pattern syntax as `query`, then copies matched files to `output`. Paths are preserved relative to the library root, so the folder structure inside `output` mirrors the original.

If a track's library root is unknown (e.g. it was indexed before `library_root` tracking was added), its filename alone is used.

## Multiple libraries

Audex supports indexing several directories into the same database. Each gets its own row in the `libraries` table. When querying or copying, pass `--library <path>` to scope results to one library root.

```bash
audex library index ~/music/flac
audex library index ~/music/aac

# Query only the AAC library
audex library query "artist:Radiohead" --library ~/music/aac
```
