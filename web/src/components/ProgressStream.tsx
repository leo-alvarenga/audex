import { useEffect, useRef, useState } from "react";
import { streamOperation, type OperationResult } from "../lib/api";

interface Props {
  endpoint: string | null;
  body: object;
  onDone: (result: OperationResult) => void;
  onError: (message: string) => void;
}

export function ProgressStream({ endpoint, body, onDone, onError }: Props) {
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [log, setLog] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!endpoint) return;
    let cancelled = false;

    (async () => {
      try {
        for await (const event of streamOperation(endpoint, body)) {
          if (cancelled) break;
          if (event.type === "progress") {
            setProgress({ done: event.done as number, total: event.total as number, current: event.current as string });
            if (event.current) setLog((l) => [...l, event.current as string]);
          } else if (event.type === "done") {
            onDone(event.result as OperationResult);
          } else if (event.type === "error") {
            onError(event.message as string);
          }
        }
      } catch (e) {
        if (!cancelled) onError((e as Error).message);
      }
    })();

    return () => { cancelled = true; };
    // ponytail: endpoint is the run token; body is read once per run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  if (!endpoint) return null;

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-sm text-gray-600">
        {progress.done}/{progress.total} {progress.current}
      </div>
      <div
        ref={logRef}
        className="bg-gray-50 border rounded p-2 h-40 overflow-auto text-xs font-mono"
      >
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}
