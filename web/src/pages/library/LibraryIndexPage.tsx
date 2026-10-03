import { useState } from "react";
import { DirPicker } from "../../components/DirPicker";
import { FlagSwitch } from "../../components/FlagSwitch";
import { ProgressStream } from "../../components/ProgressStream";
import { StatsTable } from "../../components/StatsTable";
import type { OperationResult } from "../../lib/api";

export function LibraryIndexPage() {
  const [input, setInput] = useState("");
  const [force, setForce] = useState(false);
  const [running, setRunning] = useState<object | null>(null);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!input) return;
    setResult(null); setError(null);
    setRunning({ input, force });
  };

  return (
    <div className="max-w-xl flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Index Library</h1>
      <DirPicker label="Directory" value={input} onChange={setInput} />
      <FlagSwitch label="Force re-index" checked={force} onChange={setForce} />
      <button
        className="bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        onClick={submit}
        disabled={!input || running !== null}
      >
        Index
      </button>
      <ProgressStream
        endpoint={running ? "/api/library/index" : null}
        body={running ?? {}}
        onDone={(r) => { setResult(r); setRunning(null); }}
        onError={(e) => { setError(e); setRunning(null); }}
      />
      {result && <StatsTable stats={result.stats} errors={result.errors} />}
      {error && <div className="text-red-600 text-sm">{error}</div>}
    </div>
  );
}
