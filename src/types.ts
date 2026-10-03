export type Tree = { files: Map<string, string>; dirs: Set<string> };

export type SyncAction =
  | { kind: "mkdir"; rel: string }
  | { kind: "copy"; rel: string }
  | { kind: "delete"; rel: string };

export interface FpcalcResult {
  duration: number;
  fingerprint: string;
}

export interface TrackMeta {
  title: string;
  album: string;
  track: number; // 0 = unknown
  year?: number;
  artist: string;
  genre?: string;
  albumArtist?: string;
  coverUrl?: string;
}

export interface OperationResult {
  ok: boolean;
  stats: Record<string, number>;
  errors: string[];
  plan?: string[];
}

export interface ProgressEvent {
  done: number;
  total: number;
  current: string;
}

export type ProgressCallback = (event: ProgressEvent) => void;
