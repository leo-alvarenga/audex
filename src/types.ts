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
}
