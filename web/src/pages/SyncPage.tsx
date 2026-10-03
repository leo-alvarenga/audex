import { useState } from "react";
import { DirPicker } from "../components/DirPicker";
import { FlagSwitch } from "../components/FlagSwitch";
import { ProgressStream } from "../components/ProgressStream";
import { StatsTable } from "../components/StatsTable";
import type { OperationResult } from "../lib/api";

export function SyncPage() {
  const [origin, setOrigin] = useState("");
  const [dest, setDest] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [force, setForce] = useState(false);
  const [running, setRunning] = useState<object | null>(null);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!origin || !dest) return;
    setResult(null); setError(null);
    setRunning({ origin, dest, dryRun, force });
  };

  return (
    <div className="max-w-xl flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Sync</h1>
      <DirPicker label="Origin" value={origin} onChange={setOrigin} />
      <DirPicker label="Destination" value={dest} onChange={setDest} />
      <FlagSwitch label="Dry run" checked={dryRun} onChange={setDryRun} />
      <FlagSwitch label="Force" checked={force} onChange={setForce} description="Delete files in dest not in origin" />
      <button
        className="bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        onClick={submit}
        disabled={!origin || !dest || running !== null}
      >
        Sync
      </button>
      <ProgressStream
        endpoint={running ? "/api/sync" : null}
        body={running ?? {}}
        onDone={(r) => { setResult(r); setRunning(null); }}
        onError={(e) => { setError(e); setRunning(null); }}
      />
      {result && <StatsTable stats={result.stats} errors={result.errors} plan={result.plan} />}
      {error && <div className="text-red-600 text-sm">{error}</div>}
    </div>
  );
}
