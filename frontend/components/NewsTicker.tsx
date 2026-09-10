import Link from "next/link";
import { prisma } from "@/lib/prisma";

// Fallback for the top-of-page ScoreTracker row on days with nothing to score
// (pre-season, the off-season) — a scrolling feed of recent league moves
// instead of a blank strip: waiver activity, trade-block adds, signings, trades.
const TYPE_HREF: Record<string, string> = { WAIVER: "/waivers", TRADE_BLOCK: "/trade-block", SIGNING: "/signings", TRADE: "/transactions" };
const TYPE_PILL: Record<string, { label: string; cls: string }> = {
  WAIVER: { label: "Waivers", cls: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30" },
  TRADE_BLOCK: { label: "Trade Block", cls: "bg-purple-500/15 text-purple-300 ring-1 ring-purple-500/30" },
  SIGNING: { label: "Signing", cls: "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30" },
  TRADE: { label: "Trade", cls: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" },
};

type TeamLite = { id: number; name: string; code: string | null; logoUrl: string | null };

function timeAgo(d: Date): string {
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

export default async function NewsTicker() {
  const items = await prisma.transaction.findMany({
    where: {
      type: { in: ["WAIVER", "TRADE_BLOCK", "SIGNING", "TRADE"] },
      NOT: { OR: [
        { message: { contains: "proposed a trade" } },
        { message: { contains: "Awaiting response" } },
        { message: { contains: "was declined" } },
        { message: { contains: "was cancelled" } },
      ] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, type: true, message: true, teamId: true, createdAt: true },
  });
  if (items.length === 0) return null;

  // Resolve up to two club logos per item: the linked team (when the write
  // recorded one) first, then any other club named in the message text — which
  // is how a two-sided TRADE ("X traded ... to Y") or a waiver claim ("A claimed
  // ... from B") picks up its second logo, same trick app/transactions uses.
  const teams = await prisma.team.findMany({ select: { id: true, name: true, code: true, logoUrl: true } });
  const PSEUDO = new Set(["UFA", "RFA", "FA"]);
  const withLogo = teams
    .filter((t) => t.logoUrl && !(t.code && PSEUDO.has(t.code)))
    .map((t) => ({ ...t, codeRe: t.code ? new RegExp(`\\b${t.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`) : null }));
  const teamById = new Map(withLogo.map((t) => [t.id, t]));

  const logosFor = (msg: string, teamId: number | null): TeamLite[] => {
    const found: TeamLite[] = [];
    const primary = teamId != null ? teamById.get(teamId) : undefined;
    if (primary) found.push(primary);
    const ranked = withLogo
      .map((t) => {
        const byCode = t.codeRe ? msg.search(t.codeRe) : -1;
        const byName = msg.indexOf(t.name);
        const idx = byCode >= 0 && (byName < 0 || byCode < byName) ? byCode : byName;
        return { t, idx };
      })
      .filter((m) => m.idx >= 0)
      .sort((a, b) => a.idx - b.idx)
      .map((m) => m.t);
    for (const t of ranked) {
      if (found.length >= 2) break;
      if (!found.some((f) => f.id === t.id)) found.push(t);
    }
    return found;
  };

  const dur = Math.max(45, items.length * 9);

  return (
    <div className="bg-[#0a1628] border-b border-slate-800 overflow-hidden">
      <style>{`
        @keyframes ntMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes ntBlink{0%,60%{opacity:1}80%,100%{opacity:.25}}
        .nt-track{animation:ntMarquee ${dur}s linear infinite}
        .nt-viewport:hover .nt-track{animation-play-state:paused}
      `}</style>
      <div className="max-w-[1400px] mx-auto flex items-stretch">
        <div className="shrink-0 bg-gradient-to-b from-blue-600 to-blue-700 text-white text-[11px] font-bold px-3.5 flex items-center gap-1.5 uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" style={{ animation: "ntBlink 1.1s infinite" }} />
          League News
        </div>
        <div
          className="nt-viewport overflow-hidden relative flex-1 h-12"
          style={{ WebkitMaskImage: "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)", maskImage: "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)" }}
        >
          <div className="nt-track absolute inset-y-0 left-0 flex items-center w-max whitespace-nowrap">
            {[0, 1].map((seg) => (
              <div key={seg} className="flex items-center">
                {items.map((tx, i) => {
                  const logos = logosFor(tx.message, tx.teamId);
                  const pill = TYPE_PILL[tx.type] ?? { label: tx.type, cls: "bg-slate-700/40 text-slate-300 ring-1 ring-slate-600" };
                  return (
                    <Link
                      key={`${seg}-${tx.id}-${i}`}
                      href={TYPE_HREF[tx.type] ?? "/transactions"}
                      className="group/item inline-flex items-center gap-2.5 mx-1.5 pl-2 pr-3.5 py-1.5 rounded-xl bg-slate-800/40 border border-slate-800 hover:border-slate-600 hover:bg-slate-800/80 transition-colors"
                    >
                      <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${pill.cls}`}>{pill.label}</span>
                      {logos.length > 0 && (
                        <span className="flex items-center gap-1 shrink-0">
                          {logos.map((t, li) => (
                            <span key={t.id} className="flex items-center gap-1">
                              {li > 0 && <span className="text-slate-600 text-[10px]">→</span>}
                              <img src={t.logoUrl!} alt={t.code ?? ""} title={t.name} className="w-5 h-5 object-contain rounded-full bg-slate-900/70 ring-1 ring-slate-700" />
                            </span>
                          ))}
                        </span>
                      )}
                      <span className="text-sm text-slate-200 group-hover/item:text-white transition-colors">{tx.message}</span>
                      <span className="shrink-0 text-[10px] text-slate-500 tabular-nums">{timeAgo(tx.createdAt)}</span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
