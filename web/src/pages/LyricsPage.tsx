import { useState } from "react";
import { DirPicker } from "../components/DirPicker";
import { FlagSwitch } from "../components/FlagSwitch";
import { ProgressStream } from "../components/ProgressStream";
import { StatsTable } from "../components/StatsTable";
import type { OperationResult } from "../lib/api";

export function LyricsPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [running, setRunning] = useState<object | null>(null);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!input) return;
    setResult(null); setError(null);
    setRunning({ input, output: output || undefined, dryRun });
  };

  return (
    <div className="max-w-xl flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Lyrics</h1>
      <DirPicker label="Input" value={input} onChange={setInput} />
      <DirPicker label="Output (optional)" value={output} onChange={setOutput} />
      <FlagSwitch label="Dry run" checked={dryRun} onChange={setDryRun} />
      <button
        className="bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        onClick={submit}
        disabled={!input || running !== null}
      >
        Fetch Lyrics
      </button>
      <ProgressStream
        endpoint={running ? "/api/lyrics" : null}
        body={running ?? {}}
        onDone={(r) => { setResult(r); setRunning(null); }}
        onError={(e) => { setError(e); setRunning(null); }}
      />
      {result && <StatsTable stats={result.stats} errors={result.errors} plan={result.plan} />}
      {error && <div className="text-red-600 text-sm">{error}</div>}
    </div>
  );
}
