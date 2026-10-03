import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

const DB_DIR = join(homedir(), ".audex");
const DB_PATH = join(DB_DIR, "library.db");

export interface LibraryTrack {
  path: string;
  artist: string | null;
  album: string | null;
  albumArtist: string | null;
  title: string | null;
  track: number | null;
  year: number | null;
  genre: string | null;
  duration: number | null;
  fileSize: number | null;
  mtime: number | null;
  indexedAt: number | null;
  libraryRoot: string | null;
}

interface TrackRow {
  path: string;
  artist: string | null;
  album: string | null;
  album_artist: string | null;
  title: string | null;
  track: number | null;
  year: number | null;
  genre: string | null;
  duration: number | null;
  file_size: number | null;
  mtime: number | null;
  indexed_at: number | null;
  library_root: string | null;
}

const FIELDS: Record<string, string> = {
  artist: "artist",
  album: "album",
  albumArtist: "album_artist",
  album_artist: "album_artist",
  title: "title",
  year: "year",
  genre: "genre",
  libraryRoot: "library_root",
  library_root: "library_root",
};

function toTrack(r: TrackRow): LibraryTrack {
  return {
    path: r.path,
    artist: r.artist,
    album: r.album,
    albumArtist: r.album_artist,
    title: r.title,
    track: r.track,
    year: r.year,
    genre: r.genre,
    duration: r.duration,
    fileSize: r.file_size,
    mtime: r.mtime,
    indexedAt: r.indexed_at,
    libraryRoot: r.library_root,
  };
}

// Split on whitespace, keeping quoted values together and dropping the quotes
function tokenize(pattern: string): string[] {
  const out: string[] = [];
  let current = "";
  let quote = false;

  for (const ch of pattern) {
    if (ch === '"') {
      quote = !quote;
      continue;
    }

    if (!quote && /\s/.test(ch)) {
      if (current) out.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  if (current) out.push(current);

  return out;
}

export function openLibrary(): Database.Database {
  mkdirSync(DB_DIR, { recursive: true });

  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      path TEXT PRIMARY KEY,
      artist TEXT,
      album TEXT,
      album_artist TEXT,
      title TEXT,
      track INTEGER,
      year INTEGER,
      genre TEXT,
      duration REAL,
      file_size INTEGER,
      mtime INTEGER,
      indexed_at INTEGER DEFAULT (unixepoch())
    )
  `);

  try {
    db.exec("ALTER TABLE tracks ADD COLUMN library_root TEXT");
  } catch {
    // already present — no-op
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS libraries (
      root TEXT PRIMARY KEY,
      created_at INTEGER DEFAULT (unixepoch())
    )
  `);

  return db;
}

export function upsertTrack(
  db: Database.Database,
  track: Omit<LibraryTrack, "indexedAt">,
): void {
  db.prepare(
    `INSERT OR REPLACE INTO tracks
       (path, artist, album, album_artist, title, track, year, genre, duration, file_size, mtime, library_root)
     VALUES
       (@path, @artist, @album, @albumArtist, @title, @track, @year, @genre, @duration, @fileSize, @mtime, @libraryRoot)`,
  ).run({
    path: track.path,
    artist: track.artist,
    album: track.album,
    albumArtist: track.albumArtist,
    title: track.title,
    track: track.track,
    year: track.year,
    genre: track.genre,
    duration: track.duration,
    fileSize: track.fileSize,
    mtime: track.mtime,
    libraryRoot: track.libraryRoot,
  });
}

export function trackUnchanged(
  db: Database.Database,
  path: string,
  fileSize: number,
  mtime: number,
): boolean {
  const row = db
    .prepare(
      "SELECT 1 FROM tracks WHERE path = ? AND file_size = ? AND mtime = ?",
    )
    .get(path, fileSize, mtime);

  return Boolean(row);
}

export function queryTracks(
  db: Database.Database,
  pattern: string,
  libraryRoot?: string,
): LibraryTrack[] {
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (libraryRoot) {
    clauses.push("library_root = ?");
    params.push(libraryRoot);
  }

  for (const token of tokenize(pattern)) {
    if (token === "*") continue;
    const match = /^([A-Za-z_]+):(.*)$/.exec(token);
    const column = match ? FIELDS[match[1]] : undefined;

    if (match && column) {
      clauses.push(`${column} = ?`);
      params.push(match[2]);
      continue;
    }

    clauses.push("(title LIKE ? OR artist LIKE ? OR album LIKE ?)");
    params.push(`%${token}%`, `%${token}%`, `%${token}%`);
  }

  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM tracks${where}`)
    .all(...params) as TrackRow[];

  return rows.map(toTrack);
}

export function registerLibrary(db: Database.Database, root: string): void {
  db.prepare("INSERT OR IGNORE INTO libraries (root) VALUES (?)").run(root);
}

export function isLibraryIndexed(db: Database.Database, root: string): boolean {
  return Boolean(db.prepare("SELECT 1 FROM libraries WHERE root = ?").get(root));
}

export function pruneLibrary(
  db: Database.Database,
  root: string,
  livePaths: string[],
): number {
  const liveSet = new Set(livePaths);
  const stored = db
    .prepare("SELECT path FROM tracks WHERE library_root = ?")
    .all(root) as { path: string }[];
  const stale = stored.filter((r) => !liveSet.has(r.path));
  if (stale.length === 0) return 0;
  const del = db.prepare("DELETE FROM tracks WHERE path = ?");
  db.transaction(() => { for (const r of stale) del.run(r.path); })();
  return stale.length;
}
