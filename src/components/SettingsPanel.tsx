import { SplitLimits, DEFAULT_LIMITS } from "../types";
import { formatNumber } from "../utils/splitter";

interface Props {
  limits: SplitLimits;
  onChange: (limits: SplitLimits) => void;
  open: boolean;
  onToggle: () => void;
}

interface FieldProps {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  defaultValue: number;
}

function SettingField({
  label,
  description,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  defaultValue,
}: FieldProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-700">{label}</div>
          <div className="text-xs text-slate-400">{description}</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!isNaN(v) && v >= min && v <= max) {
                onChange(v);
              }
            }}
            className="w-28 rounded-xl border-2 border-slate-950 bg-white px-3 py-1.5 text-right text-sm font-mono font-semibold text-slate-700 focus:outline-none"
          />
          <span className="text-xs text-slate-400 w-8">{unit}</span>
        </div>
      </div>

      {/* Slider */}
      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, #14b8a6 0%, #14b8a6 ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
          }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{formatNumber(min)} {unit}</span>
        <button
          onClick={() => onChange(defaultValue)}
          className="font-medium text-[var(--color-brand)] transition-colors hover:text-slate-950"
        >
          Reset ({formatNumber(defaultValue)})
        </button>
        <span>{formatNumber(max)} {unit}</span>
      </div>
    </div>
  );
}

export default function SettingsPanel({ limits, onChange, open, onToggle }: Props) {
  const resetAll = () => onChange({ ...DEFAULT_LIMITS });

  return (
    <div className="overflow-hidden rounded-[2rem] border-4 border-slate-950 bg-[color:var(--color-surface)]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-6 py-4 transition-colors hover:bg-[#fff8ef]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[1rem] border-2 border-slate-950 bg-[#fff5e6]">
            <svg className="h-4 w-4 text-slate-950" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="font-display text-lg font-black uppercase tracking-[0.08em] text-slate-950">Limit settings</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full border-2 border-slate-950 bg-[#ecfeff] px-2 py-1 text-xs text-slate-700">
            {formatNumber(limits.maxWordsPerSource)} words / source
          </span>
          <svg
            className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="space-y-6 border-t-2 border-slate-950/10 px-6 py-5">
          <div className="grid gap-6">
            <SettingField
              label="Max words per source"
              description="NotebookLM limit: 500,000 words per file"
              value={limits.maxWordsPerSource}
              min={1000}
              max={500000}
              step={1000}
              unit="words"
              onChange={(v) => onChange({ ...limits, maxWordsPerSource: v })}
              defaultValue={DEFAULT_LIMITS.maxWordsPerSource}
            />
            <div className="border-t border-slate-950/10" />
            <SettingField
              label="Max file size"
              description="NotebookLM limit: 200 MB per file"
              value={limits.maxFileSizeMB}
              min={1}
              max={200}
              step={1}
              unit="MB"
              onChange={(v) => onChange({ ...limits, maxFileSizeMB: v })}
              defaultValue={DEFAULT_LIMITS.maxFileSizeMB}
            />
            <div className="border-t border-slate-950/10" />
            <SettingField
              label="Max sources per notebook"
              description="NotebookLM limit: 50 sources per notebook"
              value={limits.maxSourcesPerNotebook}
              min={1}
              max={50}
              step={1}
              unit="files"
              onChange={(v) => onChange({ ...limits, maxSourcesPerNotebook: v })}
              defaultValue={DEFAULT_LIMITS.maxSourcesPerNotebook}
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-slate-400">
              Limits match the official NotebookLM documentation
            </div>
            <button
              onClick={resetAll}
              className="flex items-center gap-1 text-xs font-semibold text-[var(--color-brand)] transition-colors hover:text-slate-950"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
