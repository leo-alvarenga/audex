import { useState } from "react";
import { DirPicker } from "../../components/DirPicker";
import { FlagSwitch } from "../../components/FlagSwitch";
import { ProgressStream } from "../../components/ProgressStream";
import { StatsTable } from "../../components/StatsTable";
import type { OperationResult } from "../../lib/api";

export function LibraryCopyPage() {
  const [output, setOutput] = useState("");
  const [pattern, setPattern] = useState("*");
  const [library, setLibrary] = useState("");
  const [force, setForce] = useState(false);
  const [running, setRunning] = useState<object | null>(null);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!output) return;
    setResult(null); setError(null);
    setRunning({ output, pattern, library: library || undefined, force });
  };

  return (
    <div className="max-w-xl flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Copy Tracks</h1>
      <DirPicker label="Output directory" value={output} onChange={setOutput} />
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Pattern</label>
        <input className="border rounded px-3 py-2 text-sm" value={pattern} onChange={(e) => setPattern(e.target.value)} />
      </div>
      <DirPicker label="Library filter (optional)" value={library} onChange={setLibrary} />
      <FlagSwitch label="Force" checked={force} onChange={setForce} description="Overwrite existing files" />
      <button
        className="bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        onClick={submit}
        disabled={!output || running !== null}
      >
        Copy
      </button>
      <ProgressStream
        endpoint={running ? "/api/library/copy" : null}
        body={running ?? {}}
        onDone={(r) => { setResult(r); setRunning(null); }}
        onError={(e) => { setError(e); setRunning(null); }}
      />
      {result && <StatsTable stats={result.stats} errors={result.errors} />}
      {error && <div className="text-red-600 text-sm">{error}</div>}
    </div>
  );
}
