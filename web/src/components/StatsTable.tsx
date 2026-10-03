interface Props {
  stats: Record<string, number>;
  errors: string[];
  plan?: string[];
}

export function StatsTable({ stats, errors, plan }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <table className="text-sm border rounded w-full">
        <tbody>
          {Object.entries(stats).map(([k, v]) => (
            <tr key={k} className="border-b last:border-0">
              <td className="px-3 py-2 text-gray-600 capitalize">{k.replace(/([A-Z])/g, " $1")}</td>
              <td className="px-3 py-2 font-mono text-right">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {plan && plan.length > 0 && (
        <div className="bg-gray-50 border rounded p-3 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-auto">
          {plan.join("\n")}
        </div>
      )}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded p-3">
          {errors.map((e, i) => <div key={i} className="text-xs text-red-700">{e}</div>)}
        </div>
      )}
    </div>
  );
}
