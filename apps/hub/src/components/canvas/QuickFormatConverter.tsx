import { useEffect, useMemo, useState } from 'react';
import {
  QUICK_TOOLS_STORAGE_KEYS,
  loadPersistedJson,
  savePersistedJson,
} from '../../lib/canvas/quickToolsCanvasStorage';
import {
  convertDataFormat,
  validateFormat,
  type DataFormat,
} from '../../lib/quick/formatConverter';

interface FormState {
  inputFormat: DataFormat;
  outputFormat: DataFormat;
  input: string;
}

const DEFAULTS: FormState = {
  inputFormat: 'json',
  outputFormat: 'csv',
  input: '{\n  "name": "GramSeva Mitra",\n  "plan": "free",\n  "credits": 10\n}',
};

const FORMATS: DataFormat[] = ['json', 'csv', 'xml'];

export default function QuickFormatConverter() {
  const initial = useMemo(
    () => loadPersistedJson<FormState>(QUICK_TOOLS_STORAGE_KEYS.formatConverter, DEFAULTS),
    [],
  );
  const [inputFormat, setInputFormat] = useState<DataFormat>(initial.inputFormat);
  const [outputFormat, setOutputFormat] = useState<DataFormat>(initial.outputFormat);
  const [input, setInput] = useState(initial.input);
  const [output, setOutput] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    savePersistedJson(QUICK_TOOLS_STORAGE_KEYS.formatConverter, {
      inputFormat,
      outputFormat,
      input,
    });
  }, [input, inputFormat, outputFormat]);

  const inputClass =
    'w-full rounded-xl border border-canvas-border bg-canvas-surface px-3 py-2.5 font-mono text-xs text-white outline-none ring-violet-500/30 focus:border-violet-400 focus:ring-2';

  const runConvert = () => {
    const result = convertDataFormat(input, inputFormat, outputFormat);
    if (result.ok && result.output !== undefined) {
      setOutput(result.output);
      setMessage('Conversion successful.');
      setIsError(false);
    } else {
      setOutput('');
      setMessage(result.error ?? 'Conversion failed.');
      setIsError(true);
    }
  };

  const runValidate = () => {
    const result = validateFormat(input, inputFormat);
    setMessage(result.ok ? result.output ?? 'Valid.' : result.error ?? 'Invalid.');
    setIsError(!result.ok);
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-200">Input format</span>
          <select
            value={inputFormat}
            onChange={(e) => setInputFormat(e.target.value as DataFormat)}
            className={inputClass}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-200">Output format</span>
          <select
            value={outputFormat}
            onChange={(e) => setOutputFormat(e.target.value as DataFormat)}
            className={inputClass}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-200">Input</span>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          rows={8}
          className={`${inputClass} resize-y`}
          spellCheck={false}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runConvert}
          className="rounded-xl bg-canvas-accent-muted px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-canvas-accent/40"
        >
          Convert
        </button>
        <button
          type="button"
          onClick={runValidate}
          className="rounded-xl border border-canvas-border bg-canvas-surface px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-canvas-elevated"
        >
          Validate input
        </button>
      </div>

      {message && (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            isError
              ? 'border-rose-500/40 bg-rose-950/30 text-rose-200'
              : 'border-emerald-500/40 bg-emerald-950/20 text-emerald-200'
          }`}
        >
          {message}
        </p>
      )}

      {output && (
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-200">Output</span>
          <textarea readOnly value={output} rows={10} className={`${inputClass} resize-y`} />
        </label>
      )}
    </div>
  );
}
