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

export interface TagPlan {
  version: number;
  files: Record<string, Partial<TrackMeta>>;
}
