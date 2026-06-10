interface RadioGroupProps<T extends string> {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (value: T) => void;
  name: string;
}

export default function RadioGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  name,
}: RadioGroupProps<T>) {
  return (
    <fieldset>
      <legend className="label text-emerald-200">{label}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {options.map((opt) => (
          <label
            key={opt.id}
            className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition ${
              value === opt.id
                ? 'border-[#10b981] bg-[#064e3b]/60 text-[#10b981]'
                : 'border-emerald-900/50 text-slate-400 hover:border-emerald-700 hover:text-emerald-200'
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt.id}
              checked={value === opt.id}
              onChange={() => onChange(opt.id)}
              className="sr-only"
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
