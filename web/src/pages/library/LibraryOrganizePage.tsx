import { useState } from "react";
import { DirPicker } from "../../components/DirPicker";
import { FlagSwitch } from "../../components/FlagSwitch";
import { ProgressStream } from "../../components/ProgressStream";
import { StatsTable } from "../../components/StatsTable";
import type { OperationResult } from "../../lib/api";

export function LibraryOrganizePage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [copy, setCopy] = useState(false);
  const [forceIndex, setForceIndex] = useState(false);
  const [force, setForce] = useState(false);
  const [running, setRunning] = useState<object | null>(null);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!input) return;
    setResult(null); setError(null);
    setRunning({ input, output: output || undefined, copy, forceIndex, force });
  };

  return (
    <div className="max-w-xl flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Organize Library</h1>
      <DirPicker label="Input" value={input} onChange={setInput} />
      <DirPicker label="Output (leave empty for in-place)" value={output} onChange={setOutput} />
      <FlagSwitch label="Copy" checked={copy} onChange={setCopy} description="Copy instead of moving" />
      <FlagSwitch label="Force re-index" checked={forceIndex} onChange={setForceIndex} />
      <FlagSwitch label="Force" checked={force} onChange={setForce} description="Overwrite existing files" />
      <button
        className="bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        onClick={submit}
        disabled={!input || running !== null}
      >
        Organize
      </button>
      <ProgressStream
        endpoint={running ? "/api/library/organize" : null}
        body={running ?? {}}
        onDone={(r) => { setResult(r); setRunning(null); }}
        onError={(e) => { setError(e); setRunning(null); }}
      />
      {result && <StatsTable stats={result.stats} errors={result.errors} />}
      {error && <div className="text-red-600 text-sm">{error}</div>}
    </div>
  );
}
