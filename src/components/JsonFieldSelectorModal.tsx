import type { JsonFieldOption } from "../utils/jsonFields";

export interface JsonFieldConfig {
  fileKey: string;
  fileName: string;
  fieldOptions: JsonFieldOption[];
  selectedPaths: string[];
}

interface Props {
  config: JsonFieldConfig;
  onCancel: () => void;
  onConfirm: () => void;
  onChangeSelection: (fileKey: string, selectedPaths: string[]) => void;
}

function fileSelectionSummary(config: JsonFieldConfig): string {
  return `${config.selectedPaths.length} / ${config.fieldOptions.length} fields selected`;
}

export default function JsonFieldSelectorModal({
  config,
  onCancel,
  onConfirm,
  onChangeSelection,
}: Props) {
  const hasInvalidSelection = config.fieldOptions.length > 0 && config.selectedPaths.length === 0;
  const selected = new Set(config.selectedPaths);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/45 px-4 py-6">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-[2rem] border-4 border-slate-950 bg-[color:var(--color-surface)] shadow-[16px_16px_0_0_rgba(15,23,42,0.16)]">
        <div className="border-b-2 border-slate-950/10 px-6 py-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-brand)]">
            JSON Import Fields
          </p>
          <h3 className="mt-2 font-display text-2xl font-black uppercase text-slate-950">
            Choose which JSON fields to keep
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            The app will keep only the selected fields before splitting the file for NotebookLM.
          </p>
        </div>

        <div className="max-h-[55vh] space-y-4 overflow-y-auto px-6 py-5">
          <section className="rounded-[1.6rem] border-2 border-slate-950 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900">{config.fileName}</h4>
                <p className="mt-1 text-xs text-slate-500">{fileSelectionSummary(config)}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onChangeSelection(
                      config.fileKey,
                      config.fieldOptions.map((field) => field.path),
                    )
                  }
                  className="rounded-full border-2 border-slate-950 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-[#fff5e6]"
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={() => onChangeSelection(config.fileKey, [])}
                  className="rounded-full border-2 border-slate-950 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-[#fff1f2]"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {config.fieldOptions.map((field) => {
                const checked = selected.has(field.path);

                return (
                  <label
                    key={field.path}
                    className={`flex cursor-pointer items-start gap-3 rounded-[1.1rem] border-2 px-3 py-3 transition-colors ${
                      checked
                        ? "border-slate-950 bg-[#fff8ef]"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        const nextSelectedPaths = event.target.checked
                          ? [...config.selectedPaths, field.path]
                          : config.selectedPaths.filter((path) => path !== field.path);
                        onChangeSelection(config.fileKey, nextSelectedPaths);
                      }}
                      className="mt-0.5 h-4 w-4 rounded border-slate-400 text-[var(--color-brand)] focus:ring-[var(--color-brand)]"
                    />
                    <span className="min-w-0">
                      <span className="block break-all font-mono text-xs font-semibold text-slate-800">
                        {field.path}
                      </span>
                      <span className="mt-1 block break-all text-xs text-slate-500">
                        {field.sampleValue}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-slate-950/10 px-6 py-4">
          <p className="text-xs text-slate-500">
            Leave at least one field selected for every configurable JSON file.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border-2 border-slate-950 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={hasInvalidSelection}
              onClick={onConfirm}
              className="rounded-full border-2 border-slate-950 bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-950 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Save fields
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
