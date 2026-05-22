import type { ProcessingStats } from "../app/types";

interface FooterStatsProps {
  stats: ProcessingStats;
}

function StatPill({ label, value }: { label: string; value: number }): JSX.Element {
  return (
    <div className="min-w-[8.5rem] rounded-[1.4rem] border-2 border-slate-950 bg-white/80 px-4 py-3 text-left shadow-[6px_6px_0_0_rgba(15,23,42,0.08)] backdrop-blur-sm">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black leading-none text-slate-950">{value}</p>
    </div>
  );
}

export default function FooterStats({ stats }: FooterStatsProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <StatPill label="Processed Today" value={stats.todayProcessed} />
      <StatPill label="Processed Total" value={stats.totalProcessed} />
    </div>
  );
}
