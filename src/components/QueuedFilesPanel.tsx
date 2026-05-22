import type { QueuedImportItem } from "../app/types";
import type { QueuedImportIssue } from "../app/types";
import { formatBytes } from "../utils/splitter";

interface Props {
  items: QueuedImportItem[];
  onClear: () => void;
  onEditJsonFields: (queueId: string) => void;
  onRemove: (queueId: string) => void;
  onStart: () => void;
  processing: boolean;
  validationIssues?: QueuedImportIssue[];
}

function selectionLabel(item: QueuedImportItem): string {
  if (item.fieldOptions.length === 0) {
    return "No JSON field filter";
  }

  if (item.selectedJsonFields.length === item.fieldOptions.length) {
    return "All JSON fields selected";
  }

  return `${item.selectedJsonFields.length} of ${item.fieldOptions.length} JSON fields selected`;
}

export default function QueuedFilesPanel({
  items,
  onClear,
  onEditJsonFields,
  onRemove,
  onStart,
  processing,
  validationIssues = [],
}: Props) {
  if (items.length === 0 && validationIssues.length === 0) {
    return null;
  }

  const hasQueuedItems = items.length > 0;
  const hasValidationIssues = validationIssues.length > 0;

  return (
    <div className="overflow-hidden rounded-[1.75rem] border-4 border-slate-950 bg-[color:var(--color-surface)] shadow-[10px_10px_0_0_rgba(15,23,42,0.1)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-950/10 bg-[#fff8ef] px-5 py-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.08em] text-slate-950">Ready to split</p>
          <p className="mt-1 text-xs text-slate-600">
            {items.length} queued file{items.length !== 1 ? "s" : ""}
            {hasValidationIssues ? `, ${validationIssues.length} blocked before read` : ""}.
            JSON files keep all fields by default until you change them.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={processing}
            onClick={onClear}
            className="rounded-full border-2 border-slate-950 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Clear queue
          </button>
          {hasQueuedItems && (
            <button
              type="button"
              disabled={processing}
              onClick={onStart}
              className="rounded-full border-2 border-slate-950 bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-950 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Start split
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 px-5 py-4">
        {items.map((item) => (
          <div
            key={item.queueId}
            className="flex flex-wrap items-start justify-between gap-3 rounded-[1.25rem] border-2 border-slate-950 bg-white px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{item.fileName}</p>
              <p className="mt-1 text-xs text-slate-500">
                {formatBytes(item.file.size)} · {selectionLabel(item)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {item.fieldOptions.length > 0 && (
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => onEditJsonFields(item.queueId)}
                  className="rounded-full border-2 border-slate-950 px-3 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-[#fff5e6] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Choose fields
                </button>
              )}
              <button
                type="button"
                disabled={processing}
                onClick={() => onRemove(item.queueId)}
                className="rounded-full border-2 border-slate-950 px-3 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-[#fff1f2] disabled:cursor-not-allowed disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          </div>
        ))}

        {hasValidationIssues && (
          <div className="rounded-[1.25rem] border-2 border-amber-500 bg-[#fff7ed] p-4">
            <p className="text-sm font-bold uppercase tracking-[0.08em] text-amber-800">
              Blocked before read
            </p>
            <div className="mt-3 space-y-3">
              {validationIssues.map((issue) => (
                <div
                  key={issue.queueId}
                  className="rounded-[1rem] border border-amber-300 bg-white px-3 py-2"
                >
                  <p className="text-sm font-semibold text-slate-900">{issue.fileName}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {formatBytes(issue.fileSizeBytes)} · {issue.reason}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
