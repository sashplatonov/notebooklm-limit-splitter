import { useRef, useState, useCallback } from "react";
import { INPUT_EXTENSIONS } from "../utils/filePipeline";

interface Props {
  onFiles: (files: File[]) => void;
}

const ACCEPTED = INPUT_EXTENSIONS;

export default function DropZone({ onFiles }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) {
        return;
      }
      const arr = Array.from(fileList).filter((f) => {
        const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
        return ACCEPTED.includes(ext);
      });
      if (arr.length > 0) {
        onFiles(arr);
      }
    },
    [onFiles]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative flex cursor-pointer select-none flex-col items-center justify-center gap-5 overflow-hidden rounded-[2rem] border-4 px-8 py-14 transition-all duration-200
        ${dragOver
          ? "border-[var(--color-accent)] bg-[#ecfeff] scale-[1.01]"
          : "border-slate-950 bg-[color:var(--color-surface)] hover:-translate-y-0.5"
        }`}
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-[2rem] bg-[var(--color-highlight)] opacity-50" />
      <div className="absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-[var(--color-brand)] opacity-10" />
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <div className={`relative z-10 flex h-20 w-20 items-center justify-center rounded-[1.75rem] border-4 border-slate-950 transition-colors duration-200
        ${dragOver ? "bg-[var(--color-accent)]" : "bg-[var(--color-brand)]"}`}
      >
        <svg
          className="h-9 w-9 text-white transition-colors duration-200"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
      </div>

      <div className="relative z-10 space-y-1 text-center">
        <p className={`font-display text-2xl font-black uppercase tracking-[0.06em] transition-colors ${dragOver ? "text-slate-950" : "text-slate-900"}`}>
          {dragOver ? "Drop files here" : "Drag files here or click to browse"}
        </p>
        <p className="text-sm text-slate-500">
          JSON, TXT, MD, CSV, YAML, XML, LOG → TXT / MD / CSV
        </p>
      </div>

      <div className="relative z-10 flex flex-wrap justify-center gap-2">
        {[".json", ".txt", ".md", ".csv"].map((ext) => (
          <span
            key={ext}
            className="rounded-full border-2 border-slate-950 bg-white px-3 py-1 text-xs font-mono font-semibold text-slate-700"
          >
            {ext}
          </span>
        ))}
        <span className="rounded-full border-2 border-slate-950 bg-[#fff5e6] px-3 py-1 text-xs font-mono font-semibold text-slate-700">
          + text-like
        </span>
      </div>
    </div>
  );
}
