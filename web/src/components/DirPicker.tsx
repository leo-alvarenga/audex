import { useState, useRef, useEffect } from "react";
import { browseDir } from "../lib/api";

interface DirPickerProps {
  label: string;
  value: string;
  onChange: (path: string) => void;
  placeholder?: string;
}

export function DirPicker({ label, value, onChange, placeholder }: DirPickerProps) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("/");
  const [dirs, setDirs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const browse = async (path: string) => {
    setError(null);
    try {
      const res = await browseDir(path);
      setCurrent(res.current);
      setDirs(res.dirs);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    browse(value || "/");
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const select = (path: string) => {
    onChange(path);
    setOpen(false);
  };

  const parent = current.split("/").slice(0, -1).join("/") || "/";

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex gap-2 items-center relative">
        <input
          type="text"
          className="flex-1 border rounded px-3 py-2 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="border rounded px-3 py-2 text-sm hover:bg-gray-100"
          onClick={handleOpen}
        >
          Browse
        </button>
        {open && (
          <div
            ref={panelRef}
            className="absolute top-full left-0 z-50 mt-1 w-full bg-white border rounded shadow-lg max-h-64 overflow-auto"
          >
            <div className="px-3 py-2 text-xs text-gray-500 border-b">{current}</div>
            {error && <div className="px-3 py-2 text-xs text-red-500">{error}</div>}
            {current !== "/" && (
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 border-b"
                onClick={() => browse(parent)}
              >
                ..
              </button>
            )}
            {dirs.map((d) => (
              <div key={d} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-100">
                <button
                  className="flex-1 text-left text-sm truncate"
                  onClick={() => browse(d)}
                >
                  {d.split("/").pop()}/
                </button>
                <button
                  className="text-xs text-blue-600 shrink-0"
                  onClick={() => select(d)}
                >
                  Select
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
