# Web UI and API

Audex includes a browser-based interface so you can run conversions, tag files, and manage your library without the terminal. It's a React app served by a small Express backend.

## Starting the web UI

First, make sure both the CLI and the web frontend are built:

```bash
pnpm build        # compiles src/ → dist/
pnpm build:web    # compiles web/ → web/dist/
```

Then start it:

```bash
audex web          # listens on http://localhost:4242
audex web --port 8080 --open   # custom port, opens browser automatically
```

The server listens on `127.0.0.1` only — it's intended for local use.

## Pages

| Page | Path | What it does |
|------|------|--------------|
| Convert | `/convert` | Transcode FLAC files to M4A |
| Tag | `/tag` | Tag audio files with metadata from MusicBrainz |
| Sync | `/sync` | Mirror one directory into another |
| Lyrics | `/lyrics` | Fetch `.lrc` files for audio files |
| Library Index | `/library/index` | Index a directory into the local library |
| Library Query | `/library/query` | Search indexed tracks |
| Library Copy | `/library/copy` | Copy matched tracks to an output folder |
| Library Organize | `/library/organize` | Reorganize files into Artist/Album/Track layout |

Operations that take time (convert, tag, sync, lyrics, library index) stream progress back to the browser over SSE, so you can watch files being processed in real time without polling.

## HTTP API

The web UI talks to a REST API that mirrors the CLI commands. All endpoints accept and return JSON. Long-running operations use Server-Sent Events for progress updates.

### Progress streaming

Endpoints that stream progress open an SSE connection. Events arrive as:

```
data: {"type":"progress","value":1,"total":42,"label":"some/file.flac"}\n\n
```

When the operation finishes:

```
data: {"type":"done","result":{...}}\n\n
```

On error:

```
data: {"type":"error","message":"..."}\n\n
```

---

### POST /api/convert

Transcodes FLAC files to M4A.

**Request body**

```json
{
  "input": "/absolute/path/to/flac",
  "output": "/absolute/path/to/aac",
  "autoTag": false,
  "dryRun": false,
  "includeLyrics": false
}
```

`input` and `output` are required. All other fields default to `false`.

**Response**: SSE stream ending with `{ result: { stats, errors } }`.

---

### POST /api/tag

Tags audio files using MusicBrainz/AcoustID.

**Request body**

```json
{
  "input": "/absolute/path/to/audio",
  "output": "/absolute/path/to/tagged",
  "overwrite": false,
  "includeLyrics": false
}
```

`input` is required. Omit `output` to tag in place.

**Response**: SSE stream ending with `{ result: { stats, errors } }`.

---

### POST /api/sync

Mirrors one directory into another.

**Request body**

```json
{
  "origin": "/absolute/path/source",
  "dest": "/absolute/path/dest",
  "dryRun": false,
  "force": false
}
```

Both `origin` and `dest` are required.

**Response**: SSE stream ending with `{ result: { stats, errors } }`.

---

### POST /api/lyrics

Fetches `.lrc` files for audio files.

**Request body**

```json
{
  "input": "/absolute/path/to/audio",
  "output": "/absolute/path/for/lrc"
}
```

`input` is required. Omit `output` to write `.lrc` files next to the audio.

**Response**: SSE stream ending with `{ result: { stats, errors } }`.

---

### GET /api/library/tracks

Returns indexed tracks. Accepts query parameters:

| Param | Description |
|-------|-------------|
| `q` | Search pattern (same syntax as `library query`) |
| `library` | Filter by library root path |
| `limit` | Max results (default: 50) |

**Response**

```json
[
  {
    "path": "/music/aac/Radiohead/OK Computer/01. Airbag.m4a",
    "artist": "Radiohead",
    "album": "OK Computer",
    "title": "Airbag",
    "track": 1,
    "year": 1997,
    ...
  }
]
```

---

### POST /api/library/index

Indexes a directory into the library.

**Request body**

```json
{
  "input": "/absolute/path/to/index",
  "force": false
}
```

**Response**: SSE stream ending with `{ result: { stats, errors } }`.

---

### POST /api/library/copy

Copies matched tracks to an output directory.

**Request body**

```json
{
  "output": "/absolute/path/dest",
  "pattern": "artist:Radiohead",
  "library": "/optional/library/root",
  "force": false
}
```

**Response**: SSE stream ending with `{ result: { stats, errors } }`.

---

### POST /api/library/organize

Reorganizes files into Artist/Album/Track layout.

**Request body**

```json
{
  "input": "/absolute/path/to/organize",
  "output": "/optional/output/path",
  "copy": false,
  "force": false,
  "forceIndex": false
}
```

**Response**: SSE stream ending with `{ result: { stats, errors } }`.

---

### GET /api/fs/dirs

Lists subdirectories of a given path. Used by the web UI's directory picker.

**Query params**

| Param | Description |
|-------|-------------|
| `path` | Directory to list (defaults to `/`) |

**Response**

```json
["subdir1", "subdir2", ...]
```
