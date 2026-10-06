import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";
import { getLeagueClock } from "@/lib/calendar-server";
import { ufaAtExpiry } from "@/lib/free-agency-server";
import { getLang } from "@/lib/lang-server";

export default async function ExpiringContractsWidget({
  teamId,
  slug,
  isGm,
  lang,
}: {
  teamId: number;
  slug: string;
  isGm?: boolean;
  lang?: string;
}) {
  const currentLang = lang ?? (await getLang().catch(() => "en"));
  const isEn = currentLang !== "cs";
  const clock = await getLeagueClock().catch(() => ({ phase: "regular" }));
  const phase = clock.phase;
  const SHOW_FINAL_YEAR = phase === "regular" || phase === "playoffs";
  const yearsFilter = SHOW_FINAL_YEAR ? { not: null, lte: 1 } : { equals: 0 };

  const org = await prisma.team.findUnique({
    where: { id: teamId },
    select: { affiliateTeams: { select: { id: true } } },
  });
  const orgIds = [teamId, ...(org?.affiliateTeams.map((a) => a.id) ?? [])];

  const expiring = await prisma.player.findMany({
    where: {
      teamId: { in: orgIds },
      rosterType: { in: ["NHL", "AHL", "NONROSTER"] },
      contractYears: yearsFilter,
      extCapHit: null,
      NOT: { capHit: 100_000 },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      age: true,
      capHit: true,
      contractYears: true,
      position: true,
      isGoalie: true,
      rosterType: true,
      birthDate: true,
      rightsReleased: true,
    },
    orderBy: { capHit: "desc" },
  });

  if (expiring.length === 0) {
    return (
      <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <span>📄</span> {isEn ? "Expiring Contracts" : "Končiace zmluvy"}
          </span>
          <Link href={`/teams/${slug}/contracts`} className="text-xs text-sky-400 hover:text-sky-300 font-bold">
            {isEn ? "Contracts →" : "Zmluvy →"}
          </Link>
        </div>
        <p className="text-xs text-slate-500 py-1">
          {isEn ? "No players on the team currently have expiring contracts." : "Žiadnemu hráčovi v tíme momentálne nekončí zmluva."}
        </p>
      </div>
    );
  }

  const ufaList = expiring.filter((p) => ufaAtExpiry(p));
  const rfaList = expiring.filter((p) => !ufaAtExpiry(p));
  const totalCapHit = expiring.reduce((sum, p) => sum + (p.capHit ?? 0), 0);
  const topExpiring = expiring.slice(0, 4);

  return (
    <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
      {/* Hlavička */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="text-amber-400">📄</span>
          <span className="text-xs font-black uppercase tracking-wider text-amber-400">
            {isEn ? `Expiring Contracts (${expiring.length})` : `Končiace zmluvy (${expiring.length})`}
          </span>
        </div>
        <Link
          href={`/teams/${slug}/contracts`}
          className="text-xs text-sky-400 hover:text-sky-300 font-bold transition-colors"
        >
          {isEn ? `All (${expiring.length}) →` : `Všetky (${expiring.length}) →`}
        </Link>
      </div>

      {/* Súhrnné mini-metriky */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase block">UFA</span>
          <span className="text-sm font-black text-rose-400 tabular-nums">{ufaList.length}</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase block">RFA</span>
          <span className="text-sm font-black text-sky-400 tabular-nums">{rfaList.length}</span>
        </div>
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase block">{isEn ? "Cap Hit" : "Objem"}</span>
          <span className="text-sm font-black text-white tabular-nums">${(totalCapHit / 1_000_000).toFixed(1)}M</span>
        </div>
      </div>

      {/* Zoznam top končiacich zmlúv */}
      <div className="space-y-1.5 pt-1">
        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
          {isEn ? "Top Expiring Deals" : "Najvyššie končiace kontrakty"}
        </span>
        {topExpiring.map((p) => {
          const isUfa = ufaAtExpiry(p);
          return (
            <div
              key={p.id}
              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/60 transition-colors text-xs"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                    isUfa
                      ? "bg-rose-500/10 text-rose-300 border-rose-500/20"
                      : "bg-sky-500/10 text-sky-300 border-sky-500/20"
                  }`}
                >
                  {isUfa ? "UFA" : "RFA"}
                </span>
                <div className="min-w-0">
                  <Link
                    href={`/players/${p.slug}`}
                    className="font-bold text-white hover:text-amber-400 truncate block transition-colors"
                  >
                    {cleanName(p.name)}
                  </Link>
                  <span className="text-[10px] text-slate-400">
                    {p.position} · {p.age} {isEn ? "yo" : "r."}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="font-mono font-bold text-white block">
                  {p.capHit ? `$${(p.capHit / 1_000_000).toFixed(2)}M` : "—"}
                </span>
                <span className="text-[9px] text-slate-500">
                  {p.contractYears === 0 ? (isEn ? "expired" : "vypršaná") : (isEn ? "1 yr left" : "1 rok")}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA tlačidlo na plnú podstránku zmlúv */}
      <Link
        href={`/teams/${slug}/contracts`}
        className="block w-full py-2 px-3 text-center rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold transition-colors mt-2"
      >
        {isGm ? (isEn ? "Negotiate & Re-sign Deals →" : "Rokovať & predĺžiť zmluvy →") : (isEn ? "View All Expiring Deals →" : "Zobraziť všetky končiace zmluvy →")}
      </Link>
    </div>
  );
}
