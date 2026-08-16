import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { getLeagueClock } from "@/lib/calendar-server";
import { getTeamSession } from "@/lib/auth";
import { loadSettings } from "@/lib/sim/settings";
import { compensationLabel } from "@/lib/offer-sheet";
import { cleanName } from "@/lib/playerName";
import InfoTip from "@/components/InfoTip";
import OfferSheetButton from "@/components/OfferSheetButton";

export const dynamic = "force-dynamic";

const M = (c: number | null) => (c != null ? `$${(c / 1_000_000).toFixed(1)}M` : "—");
const grpOf = (pos: string | null, isGoalie: boolean) => (isGoalie || pos === "G" ? "G" : pos === "D" ? "D" : "F");

export default function OfferSheetsPage() {
  return <Board />;
}

async function Board() {
  const [clock, settings] = await Promise.all([getLeagueClock(), loadSettings()]);

  // the simple free-agency system has no RFA rights / offer sheets
  if (settings.faMode === "simple") {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <PageHeader title="Offer Sheets" subtitle="Restricted free agency" />
        <Card><p className="text-sm text-slate-400">This league runs the <b>simple</b> free-agency system — there are no RFA rights, franchise tags or offer sheets. Every expiring player becomes an unrestricted free agent and tests the open market in the <b>Free Agent Frenzy</b>. The commissioner can switch to the full system in engine settings.</p></Card>
      </div>
    );
  }

  const osWindow = clock.frenzyOpen && clock.frenzyDay >= settings.osOpenDay && clock.frenzyDay <= settings.osCloseDay;

  // the acting club (the logged-in GM's NHL team)
  const sessionId = await getTeamSession();
  const myTeam = sessionId
    ? await prisma.team.findUnique({ where: { id: sessionId }, select: { id: true, code: true, league: true, isAffiliate: true } })
    : null;
  const canOffer = !!myTeam && myTeam.league === "NHL" && !myTeam.isAffiliate;

  // RFA-age (≤26) players whose deal is ending (final year / expired)
  const rfas = await prisma.player.findMany({
    where: { rosterType: { in: ["NHL", "AHL"] }, age: { lte: settings.rfaMaxAge }, contractYears: { not: null, lte: 1 } },
    select: { id: true, name: true, position: true, isGoalie: true, age: true, capHit: true, teamId: true, franchiseTag: true, resignStatus: true },
    orderBy: [{ capHit: "desc" }],
  });
  const teams = await prisma.team.findMany({ where: { id: { in: [...new Set(rfas.map((r) => r.teamId))] } }, select: { id: true, code: true, slug: true } });
  const tById = new Map(teams.map((t) => [t.id, t]));

  // this club's own live offer sheets (to prefill the button)
  const myOffers = canOffer
    ? await prisma.offerSheet.findMany({ where: { fromTeamId: myTeam!.id, status: "PENDING" }, select: { playerId: true, salary: true, years: true } })
    : [];
  const myByPlayer = new Map(myOffers.map((o) => [o.playerId, o]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
      <PageHeader title="Offer Sheets" subtitle="RFAs who may become available to rival clubs after the season" />
      <Card>
        <p className="text-sm text-slate-400">Restricted free agents ({settings.rfaMaxAge} or younger) whose contracts are ending. A club re-signs its RFA during the season; if it doesn&apos;t and the player isn&apos;t <b className="text-fuchsia-300">Franchise-tagged</b>, he opens up to <b className="text-emerald-300">offer sheets</b>. Rival clubs may submit an offer on <b>days {settings.osOpenDay}–{settings.osCloseDay}</b> of the off-season; each player decides by day {settings.osDecisionDay} — he takes the best offer that beats his own club and meets his ask, or declines (then his club can keep negotiating).</p>
        {!osWindow && <p className="text-xs text-slate-500 mt-2">The offer-sheet window opens on day {settings.osOpenDay} of the off-season (July 1).</p>}
        {osWindow && !canOffer && <p className="text-xs text-amber-400/80 mt-2">Sign in as an NHL club to submit offer sheets.</p>}
      </Card>

      {settings.osCompEnabled && (
        <Card>
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Compensation ladder<InfoTip text="What the poaching club pays the old club in draft picks, by the offer sheet's yearly salary. The commissioner sets these. You may only surrender your own original picks." /></div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
            {settings.osCompTiers.map((t, i) => {
              const prev = i > 0 ? settings.osCompTiers[i - 1].maxAav : 0;
              // exclusive bands: ≤$1M, then >$1M–$3M, …, then >$8M
              const range = t.maxAav === 0 ? `over ${M(prev)}` : i === 0 ? `≤ ${M(t.maxAav)}` : `over ${M(prev)}–${M(t.maxAav)}`;
              return (
                <div key={i} className="rounded-lg bg-slate-800/50 border border-slate-700 px-2 py-2">
                  <div className="text-[11px] text-slate-400">{range}</div>
                  <div className="text-sm font-semibold text-emerald-300 mt-0.5">{compensationLabel(t.picks)}</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {rfas.length === 0 ? (
        <Card><p className="text-sm text-slate-500">No RFAs with expiring deals right now.</p></Card>
      ) : (
        <Card bodyClassName="p-0">
          <div className="divide-y divide-slate-800/60">
            {rfas.map((p) => {
              const t = tById.get(p.teamId);
              const eligible = p.resignStatus === "osEligible" && !p.franchiseTag;
              const mine = p.teamId === myTeam?.id;
              const existing = myByPlayer.get(p.id) ?? null;

              let status: { label: string; cls: string };
              if (p.franchiseTag) status = { label: "Franchise — 2 rounds first", cls: "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30" };
              else if (eligible && !osWindow) status = { label: "Will be available for OS", cls: "bg-sky-500/15 text-sky-300 border-sky-500/30" };
              else status = { label: "Non eligible for OS", cls: "bg-slate-700/40 text-slate-400 border-slate-600/40" };

              const showButton = eligible && osWindow && canOffer && !mine;

              return (
                <div key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/players/${p.id}`} className="text-sm font-semibold hover:text-blue-400">{cleanName(p.name)}</Link>
                    <span className="ml-1.5 text-[11px] text-slate-500">{p.position} · {p.age}y · {M(p.capHit)}</span>
                    {t && <Link href={`/teams/${t.slug}`} className="ml-1.5 text-[11px] text-slate-500 hover:text-blue-400">{t.code}</Link>}
                    {existing && <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Your OS</span>}
                    {mine && eligible && <span className="ml-1.5 text-[11px] text-slate-500">(your RFA)</span>}
                  </div>
                  {showButton ? (
                    <OfferSheetButton playerId={p.id} name={cleanName(p.name)} grp={grpOf(p.position, p.isGoalie)} fromTeamId={myTeam!.id} existing={existing} />
                  ) : (
                    <span className={`shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded border ${status.cls}`}>{status.label}</span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
