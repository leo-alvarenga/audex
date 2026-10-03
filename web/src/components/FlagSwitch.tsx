interface Props {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  description?: string;
}

export function FlagSwitch({ label, checked, onChange, description }: Props) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="text-xs text-gray-500">{description}</span>}
      </span>
    </label>
  );
}
