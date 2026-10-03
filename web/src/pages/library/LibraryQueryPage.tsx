import { useState } from "react";
import { DirPicker } from "../../components/DirPicker";
import { queryLibrary, type LibraryTrack } from "../../lib/api";

function fmt(d: number | null) {
  if (d === null) return "";
  const m = Math.floor(d / 60);
  const s = String(Math.floor(d % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

export function LibraryQueryPage() {
  const [pattern, setPattern] = useState("*");
  const [library, setLibrary] = useState("");
  const [limit, setLimit] = useState(50);
  const [tracks, setTracks] = useState<LibraryTrack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true); setError(null);
    try {
      const res = await queryLibrary({ pattern, library: library || undefined, limit });
      setTracks(res.tracks);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Query Library</h1>
      <div className="flex gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Pattern</label>
          <input
            className="border rounded px-3 py-2 text-sm w-48"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="* or artist:Pink Floyd"
          />
        </div>
        <DirPicker label="Library filter (optional)" value={library} onChange={setLibrary} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Limit</label>
          <input
            type="number"
            className="border rounded px-3 py-2 text-sm w-24"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </div>
      </div>
      <button
        className="bg-blue-600 text-white rounded px-4 py-2 text-sm w-32 disabled:opacity-50"
        onClick={submit}
        disabled={loading}
      >
        {loading ? "Loading..." : "Query"}
      </button>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      {tracks.length > 0 && (
        <div className="overflow-auto">
          <table className="text-sm border-collapse w-full">
            <thead>
              <tr className="bg-gray-100">
                {["Path", "Artist", "Album", "Title", "Year", "Duration"].map((h) => (
                  <th key={h} className="text-left px-3 py-2 border-b font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tracks.map((t, i) => (
                <tr key={i} className="hover:bg-gray-50 border-b">
                  <td className="px-3 py-1 text-xs font-mono truncate max-w-xs">{t.path.split("/").pop()}</td>
                  <td className="px-3 py-1">{t.artist}</td>
                  <td className="px-3 py-1">{t.album}</td>
                  <td className="px-3 py-1">{t.title}</td>
                  <td className="px-3 py-1">{t.year}</td>
                  <td className="px-3 py-1">{fmt(t.duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
