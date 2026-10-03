import { useState } from "react";
import { DirPicker } from "../components/DirPicker";
import { FlagSwitch } from "../components/FlagSwitch";
import { ProgressStream } from "../components/ProgressStream";
import { StatsTable } from "../components/StatsTable";
import type { OperationResult } from "../lib/api";

export function ConvertPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [autoTag, setAutoTag] = useState(false);
  const [includeLyrics, setIncludeLyrics] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [running, setRunning] = useState<object | null>(null);
  const [result, setResult] = useState<OperationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    if (!input || !output) return;
    setResult(null);
    setError(null);
    setRunning({ input, output, autoTag, includeLyrics, dryRun });
  };

  return (
    <div className="max-w-xl flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Convert</h1>
      <DirPicker label="Input directory" value={input} onChange={setInput} placeholder="/music/flac" />
      <DirPicker label="Output directory" value={output} onChange={setOutput} placeholder="/music/aac" />
      <FlagSwitch label="Auto-tag" checked={autoTag} onChange={setAutoTag} description="Fetch metadata from MusicBrainz" />
      <FlagSwitch label="Include lyrics" checked={includeLyrics} onChange={setIncludeLyrics} />
      <FlagSwitch label="Dry run" checked={dryRun} onChange={setDryRun} description="Show what would be converted without writing" />
      <button
        className="bg-blue-600 text-white rounded px-4 py-2 text-sm disabled:opacity-50"
        onClick={submit}
        disabled={!input || !output || running !== null}
      >
        Convert
      </button>
      <ProgressStream
        endpoint={running ? "/api/convert" : null}
        body={running ?? {}}
        onDone={(r) => { setResult(r); setRunning(null); }}
        onError={(e) => { setError(e); setRunning(null); }}
      />
      {result && <StatsTable stats={result.stats} errors={result.errors} plan={result.plan} />}
      {error && <div className="text-red-600 text-sm">{error}</div>}
    </div>
  );
}
