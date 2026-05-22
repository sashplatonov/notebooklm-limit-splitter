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
              if (!isNaN(v) && v >= min && v <= max) onChange(v);
            }}
            className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-right text-sm font-mono font-semibold text-slate-700 shadow-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
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
            background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`,
          }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{formatNumber(min)} {unit}</span>
        <button
          onClick={() => onChange(defaultValue)}
          className="text-violet-500 hover:text-violet-700 font-medium transition-colors"
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
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50">
            <svg className="h-4 w-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="font-semibold text-slate-700">Limit settings</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
            {formatNumber(limits.maxWordsPerSource)} words / source
          </span>
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Body */}
      {open && (
        <div className="border-t border-slate-100 px-6 py-5 space-y-6">
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
            <div className="border-t border-slate-100" />
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
            <div className="border-t border-slate-100" />
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
              className="text-xs text-violet-600 hover:text-violet-800 font-semibold transition-colors flex items-center gap-1"
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
