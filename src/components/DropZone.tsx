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
      className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-14 cursor-pointer transition-all duration-200 select-none
        ${dragOver
          ? "border-violet-400 bg-violet-50 scale-[1.01]"
          : "border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-violet-50/40"
        }`}
    >
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

      {/* Icon */}
      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-colors duration-200
        ${dragOver ? "bg-violet-100" : "bg-white border border-slate-200 shadow-sm"}`}
      >
        <svg
          className={`h-8 w-8 transition-colors duration-200 ${dragOver ? "text-violet-500" : "text-slate-400"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>
      </div>

      <div className="text-center space-y-1">
        <p className={`text-base font-semibold transition-colors ${dragOver ? "text-violet-700" : "text-slate-600"}`}>
          {dragOver ? "Drop files here" : "Drag files here or click to browse"}
        </p>
        <p className="text-sm text-slate-400">
          JSON, TXT, MD, CSV, YAML, XML, LOG → TXT / MD / CSV
        </p>
      </div>

      {/* Badge */}
      <div className="flex flex-wrap gap-2 justify-center">
        {[".json", ".txt", ".md", ".csv"].map((ext) => (
          <span
            key={ext}
            className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs font-mono font-medium text-slate-500 shadow-sm"
          >
            {ext}
          </span>
        ))}
        <span className="rounded-full bg-white border border-slate-200 px-2.5 py-0.5 text-xs font-mono font-medium text-slate-400 shadow-sm">
          + text-like
        </span>
      </div>
    </div>
  );
}
