import Link from "next/link";

export interface TeamNavItem {
  id: number;
  name: string;
  code: string | null;
  slug: string;
  logoUrl: string | null;
}

export default function TeamNavStrip({ teams }: { teams: TeamNavItem[] }) {
  if (!teams || teams.length === 0) return null;

  return (
    <div className="w-full bg-[#080d1a] border-b border-slate-800/80 shadow-inner">
      <div className="max-w-[1400px] mx-auto px-2 sm:px-4">
        <div className="flex items-center gap-1 sm:gap-1.5 py-1.5 overflow-x-auto no-scrollbar justify-start sm:justify-center">
          {teams.map((t) => (
            <Link
              key={t.id}
              href={`/teams/${t.slug}`}
              title={t.name}
              className="group relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-800/90 hover:border-sky-500/60 shadow-sm transition-all duration-150 hover:scale-110 active:scale-95 shrink-0"
            >
              {t.logoUrl ? (
                <img
                  src={t.logoUrl}
                  alt={t.name}
                  className="w-5 h-5 sm:w-6 sm:h-6 object-contain filter drop-shadow group-hover:brightness-110 transition-all"
                  loading="lazy"
                />
              ) : (
                <span className="text-[10px] font-black text-slate-400 group-hover:text-white">
                  {t.code ?? t.name.slice(0, 3)}
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
