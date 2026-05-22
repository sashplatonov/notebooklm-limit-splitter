import type { ProcessingStats } from "../app/types";
import FooterStats from "./FooterStats";

interface Props {
  stats: ProcessingStats;
}

export default function AppFooter({ stats }: Props) {
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4">
      <FooterStats stats={stats} />
      <p className="text-center text-xs text-slate-400">
        NotebookLM Splitter · Processing happens locally in your browser, files are never uploaded
      </p>
    </footer>
  );
}
