import Link from "next/link";

export type FAView = "active" | "pending" | "deliberating";

export default function FreeAgentsNav({
  view,
  activeCount,
  pendingCount,
  deliberatingCount,
  myOffersCount,
  retiredCount,
  isComish,
  isEn,
  type,
}: {
  view: FAView;
  activeCount: number;
  pendingCount?: number;
  deliberatingCount?: number;
  myOffersCount?: number;
  retiredCount?: number;
  isComish?: boolean;
  isEn: boolean;
  type?: string;
}) {
  const typeParam = type && type !== "skaters" ? `&type=${type}` : "";

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl">
      <div className="flex items-center gap-1.5 overflow-x-auto p-1 scrollbar-thin">
        {/* TAB 1: ACTIVE FREE AGENTS */}
        <Link
          href={`/free-agents?view=active${typeParam}`}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
            view === "active"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>{isEn ? "Active Free Agents" : "Voľní hráči na trhu"}</span>
          <span
            className={`px-2 py-0.5 rounded-md text-xs font-mono ${
              view === "active" ? "bg-black/25 text-blue-100" : "bg-slate-800 text-slate-400"
            }`}
          >
            {activeCount}
          </span>
        </Link>

        {/* TAB 2: PENDING FREE AGENTS */}
        <Link
          href="/free-agents?view=pending"
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
            view === "pending"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
          }`}
        >
          <span className="text-amber-400">⏳</span>
          <span>{isEn ? "Pending Free Agents" : "Končiace zmluvy (Pending)"}</span>
          <span
            className={`px-2 py-0.5 rounded-md text-xs font-mono ${
              view === "pending"
                ? "bg-black/25 text-amber-200"
                : "bg-slate-800 text-amber-400/90 border border-amber-500/30"
            }`}
          >
            {pendingCount != null ? pendingCount : "2027 UFA/RFA"}
          </span>
        </Link>

        {/* TAB 3: WEIGHING OFFERS */}
        {(deliberatingCount ?? 0) > 0 && (
          <Link
            href="/free-agents?view=deliberating"
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
              view === "deliberating"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <span>🕒</span>
            <span>{isEn ? "Weighing Offers" : "Hráči v jednaní"}</span>
            <span
              className={`px-2 py-0.5 rounded-md text-xs font-mono ${
                view === "deliberating"
                  ? "bg-black/25 text-amber-200"
                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              }`}
            >
              {deliberatingCount}
            </span>
          </Link>
        )}
      </div>

      {/* Right Side Links */}
      <div className="flex items-center gap-2 px-2 self-end sm:self-auto text-xs">
        {myOffersCount != null && (
          <Link
            href="/free-agents/my-offers"
            className="px-3 py-1.5 rounded-xl bg-blue-900/30 hover:bg-blue-800/40 border border-blue-500/30 text-blue-400 font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
          >
            <span>📨</span> {isEn ? "My Active Offers" : "Moje ponuky"}
          </Link>
        )}

        {isComish && (
          <Link
            href="/free-agents/offers"
            className="px-3 py-1.5 rounded-xl bg-amber-950/30 hover:bg-amber-900/40 border border-amber-600/30 text-amber-400 font-semibold flex items-center gap-1.5 transition whitespace-nowrap"
          >
            <span>🔒</span> {isEn ? "All Offers" : "Všetky ponuky"}
          </Link>
        )}

        {(retiredCount ?? 0) > 0 && (
          <Link
            href="/retired"
            className="px-2.5 py-1.5 rounded-xl text-slate-400 hover:text-slate-200 transition whitespace-nowrap text-xs"
          >
            {isEn ? `Retired (${retiredCount})` : `Na dôchodku (${retiredCount})`}
          </Link>
        )}
      </div>
    </div>
  );
}
