export interface OperationResult {
  ok: boolean;
  stats: Record<string, number>;
  errors: string[];
  plan?: string[];
}

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
}

export async function* streamOperation(
  endpoint: string,
  body: object,
): AsyncGenerator<{ type: string } & Record<string, unknown>> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.startsWith("data: ") ? part.slice(6) : null;
      if (line) {
        try { yield JSON.parse(line); } catch { /* skip malformed */ }
      }
    }
  }
}

export async function browseDir(path: string): Promise<{ current: string; dirs: string[] }> {
  const res = await fetch(`/api/fs/browse?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function queryLibrary(params: {
  pattern?: string;
  library?: string;
  limit?: number;
}): Promise<{ tracks: LibraryTrack[] }> {
  const qs = new URLSearchParams();
  if (params.pattern) qs.set("pattern", params.pattern);
  if (params.library) qs.set("library", params.library);
  if (params.limit) qs.set("limit", String(params.limit));
  const res = await fetch(`/api/library/query?${qs}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
