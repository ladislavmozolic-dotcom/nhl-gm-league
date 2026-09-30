import Link from "next/link";

const PRIMARY_LEAGUES = [
  { code: "WHL", label: "WHL", desc: "Western Hockey League", logoUrl: "/images/leagues/whl.svg" },
  { code: "OHL", label: "OHL", desc: "Ontario Hockey League", logoUrl: "/images/leagues/ohl.svg" },
  { code: "QMJHL", label: "QMJHL", desc: "Quebec Maritimes Junior HL", logoUrl: "/images/leagues/qmjhl.svg" },
  { code: "AHL", label: "AHL", desc: "American Hockey League", logoUrl: "/images/leagues/ahl.svg" },
  { code: "NCAA", label: "NCAA", desc: "NCAA Division I", logoUrl: "/images/leagues/ncaa.svg" },
  { code: "KHL", label: "KHL", desc: "Kontinental Hockey League", logoUrl: "/images/leagues/khl.svg" },
];

export default function WorldCompetitionNav({ activeCode }: { activeCode?: string }) {
  const isCustomCode = activeCode && activeCode !== "EUROPE" && !PRIMARY_LEAGUES.some((l) => l.code === activeCode);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-2.5">
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="px-2 font-bold uppercase tracking-wider text-slate-500 text-[10px]">Competitions:</span>
        {PRIMARY_LEAGUES.map((item) => {
          const isActive = item.code === activeCode;
          return (
            <Link
              key={item.code}
              href={`/around-the-world/${item.code.toLowerCase()}`}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-bold transition-all ${
                isActive
                  ? "border border-sky-500/50 bg-sky-500/20 text-sky-200 shadow-sm shadow-sky-500/20"
                  : "border border-slate-800/80 bg-slate-900/80 text-slate-400 hover:border-slate-700 hover:text-slate-200"
              }`}
              title={item.desc}
            >
              <img src={item.logoUrl} alt="" className="h-4 w-4 object-contain shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
        {isCustomCode && (
          <span className="rounded-lg border border-sky-500/50 bg-sky-500/20 px-3 py-1.5 font-bold text-sky-200">
            {activeCode}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/around-the-world/draft"
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/20 hover:text-white"
        >
          🎯 Draft Board
        </Link>
        <Link
          href="/around-the-world/europe"
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
            activeCode === "EUROPE"
              ? "border border-violet-500/50 bg-violet-500/20 text-violet-200 shadow-sm shadow-violet-500/20"
              : "border border-violet-500/30 bg-violet-500/10 text-violet-300 hover:bg-violet-500/20 hover:text-white"
          }`}
        >
          <img src="/images/leagues/europe.svg" alt="" className="h-3.5 w-3.5 object-contain shrink-0" />
          <span>European &amp; Russian Hub</span>
          <span className="text-[10px] text-violet-400">→</span>
        </Link>
      </div>
    </div>
  );
}
