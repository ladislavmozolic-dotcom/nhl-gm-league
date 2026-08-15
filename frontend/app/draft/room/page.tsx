import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { effectiveOrder, reverseStandingsOrder, PICKS_PER_ROUND } from "@/lib/draft-order";
import { countryFlag } from "@/lib/flags";
import DraftAvailableBoard, { type BoardProspect } from "@/components/DraftAvailableBoard";
import DraftRoundStarter from "@/components/DraftRoundStarter";
import DraftChat from "@/components/DraftChat";
import DraftPickTimer from "@/components/DraftPickTimer";
import EpHoverName from "@/components/EpHoverName";
import DraftAnnouncer from "@/components/DraftAnnouncer";
import DraftTicker from "@/components/DraftTicker";
import OffBoardPickForm from "@/components/OffBoardPickForm";
import OffBoardVerifyPanel, { type OffBoardPick } from "@/components/OffBoardVerifyPanel";
import BonusPickManager, { type BonusRow, type BonusTeam } from "@/components/BonusPickManager";
import { currentDraftYear } from "@/lib/draft-class-import";
import { currentDraftSourceWhere } from "@/lib/draft-source";

export const dynamic = "force-dynamic";

const ROUNDS = [1, 2, 3, 4, 5, 6, 7];
const posColor: Record<string, string> = { C: "text-sky-400", LW: "text-emerald-400", RW: "text-emerald-400", D: "text-amber-400", G: "text-rose-400" };

export default async function DraftRoomPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const sp = await searchParams;
  const DRAFT_YEAR = await currentDraftYear();
  const src = await currentDraftSourceWhere();

  const [drafted, availableRaw, teams, order, revStd, stateRaw, admin, me] = await Promise.all([
    prisma.draftProspect.findMany({ where: { draftYear: DRAFT_YEAR, draftedByTeamId: { not: null }, ...src }, orderBy: { overallPick: "asc" } }),
    prisma.draftProspect.findMany({ where: { draftYear: DRAFT_YEAR, draftedByTeamId: null, ...src }, orderBy: [{ potential: "desc" }, { ov: "desc" }] }),
    prisma.team.findMany({ where: { league: "NHL", isAffiliate: false }, select: { id: true, code: true, name: true, logoUrl: true } }),
    effectiveOrder(DRAFT_YEAR),
    reverseStandingsOrder(),
    prisma.draftState.findUnique({ where: { year: DRAFT_YEAR } }),
    isAdmin(),
    getTeamSession(),
  ]);
  const teamOf = new Map(teams.map((t) => [t.id, t]));
  // off-board (GM-added) picks — admins verify their eligibility
  const offBoardRaw = await prisma.draftProspect.findMany({ where: { draftYear: DRAFT_YEAR, offBoard: true, ...src }, orderBy: { overallPick: "asc" }, select: { id: true, name: true, position: true, birthDate: true, epLink: true, verified: true, overallPick: true, draftedByTeamId: true } });
  const offBoardPicks: OffBoardPick[] = offBoardRaw.map((p) => ({ id: p.id, pick: p.overallPick ?? 0, name: p.name, position: p.position, birthDate: p.birthDate, epLink: p.epLink, teamCode: (p.draftedByTeamId ? teamOf.get(p.draftedByTeamId)?.code : null) ?? "—", verified: p.verified }));
  // admin-awarded bonus picks (extra rounds)
  const bonusRaw = await prisma.draftBonusPick.findMany({ where: { year: DRAFT_YEAR, ...src }, orderBy: [{ round: "asc" }, { seq: "asc" }, { id: "asc" }], select: { id: true, round: true, teamId: true, reason: true, seq: true } });
  const bonusRows: BonusRow[] = bonusRaw.map((b) => ({ id: b.id, round: b.round, teamCode: teamOf.get(b.teamId)?.code ?? "—", reason: b.reason, seq: b.seq }));
  const bonusTeams: BonusTeam[] = teams.map((t) => ({ id: t.id, code: t.code, name: t.name }));
  // original owner of any overall pick = the team at that fixed worst-first slot
  const originalOwnerOf = (overallPick: number) => revStd[(overallPick - 1) % PICKS_PER_ROUND];
  const state = stateRaw ?? { liveRound: 0, currentPick: 33, status: "IDLE" as string };
  const fullView = sp.round === "full";
  // extra rounds (8, 9, …) exist once the admin awards bonus picks
  const bonusRounds = [...new Set(order.filter((p) => p.round > 7 && !p.deferred).map((p) => p.round))].sort((a, b) => a - b);
  const allRounds = [...ROUNDS, ...bonusRounds];
  const maxRound = allRounds[allRounds.length - 1] ?? 7;
  const round = Math.min(maxRound, Math.max(1, Number(sp.round) || (state.liveRound >= 2 ? state.liveRound : 2)));
  const allPicks = [...drafted].filter((p) => p.overallPick != null).sort((a, b) => (a.overallPick ?? 0) - (b.overallPick ?? 0));

  // the selected round's pick range from the order (base rounds are 32-wide; bonus rounds vary)
  const roundSlots = order.filter((p) => p.round === round && !p.deferred).map((p) => p.overallPick).sort((a, b) => a - b);
  const roundLo = roundSlots[0] ?? (round - 1) * PICKS_PER_ROUND + 1;
  const roundHi = roundSlots[roundSlots.length - 1] ?? round * PICKS_PER_ROUND;
  const roundPicks = drafted.filter((p) => (p.overallPick ?? 0) >= roundLo && (p.overallPick ?? 0) <= roundHi);
  const roundComplete = roundSlots.length > 0 && roundPicks.length >= roundSlots.length;

  // on-the-clock: the picker for the current overall pick
  const currentSlot = order.find((p) => p.overallPick === state.currentPick);
  const isLiveRound = state.status === "LIVE" && state.liveRound === round;
  const onClockTeam = currentSlot ? teamOf.get(currentSlot.pickerTeamId) : undefined;
  const canPick = isLiveRound && !!currentSlot && (admin || me === currentSlot.pickerTeamId);
  // pick deadline: on-the-clock time + allotted minutes (20 for R1/deferred, 30 R2-7)
  const PICK_MINUTES = currentSlot?.deferred || currentSlot?.round === 1 ? 20 : 30;
  const pickDeadline = isLiveRound && stateRaw?.onClockAt ? new Date(new Date(stateRaw.onClockAt).getTime() + PICK_MINUTES * 60000).toISOString() : null;

  // draft order for the selected round (who picks from which slot)
  const draftedByPick = new Map(drafted.filter((d) => d.overallPick != null).map((d) => [d.overallPick as number, d]));
  const roundOrder = order.filter((p) => p.round === round && !p.deferred).sort((a, b) => a.overallPick - b.overallPick);
  const deferredPicks = order.filter((p) => p.deferred).sort((a, b) => a.overallPick - b.overallPick);
  const deferredSources = new Set(deferredPicks.map((p) => p.sourcePick));

  const board: BoardProspect[] = availableRaw.map((p) => ({
    id: p.id, name: p.name, position: p.position, country: p.country, shoots: p.shoots, amateurLeague: p.amateurLeague, amateurClub: p.amateurClub, flag: countryFlag(p.country),
    heightIn: p.heightIn, weightLb: p.weightLb,
  }));

  return (
    <div className="py-2">
      <DraftTicker year={DRAFT_YEAR} />
      <DraftAnnouncer year={DRAFT_YEAR} />
      <div className="space-y-6 mt-3">
      <PageHeader title={`${DRAFT_YEAR} Draft Room`} subtitle={`Real NHL Central Scouting class · ${drafted.length} picked · ${availableRaw.length} available`} />

      {/* round switcher */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Link href="/draft/room?round=full"
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${fullView ? "border-blue-500 bg-blue-600 text-white" : "border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-600"}`}>
          Full Draft
        </Link>
        {allRounds.map((r) => {
          const slots = order.filter((p) => p.round === r && !p.deferred);
          const done = slots.length > 0 && slots.every((p) => draftedByPick.has(p.overallPick));
          const live = state.status === "LIVE" && state.liveRound === r;
          return (
            <Link key={r} href={`/draft/room?round=${r}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${!fullView && r === round ? "border-blue-500 bg-blue-600 text-white" : r > 7 ? "border-amber-700/50 bg-amber-900/20 text-amber-200 hover:border-amber-600" : "border-slate-800 bg-slate-900/50 text-slate-300 hover:border-slate-600"}`}>
              Round {r}{r > 7 && " ★"}{done && <span className="ml-1.5 text-[10px] text-emerald-400">✓</span>}{live && <span className="ml-1.5 text-[10px] text-amber-400">● live</span>}
            </Link>
          );
        })}
      </div>

      {admin && <BonusPickManager teams={bonusTeams} bonus={bonusRows} />}

      {fullView ? (
        <div>
          <div className="text-sm text-slate-400 mb-2">Full Draft — <span className="text-slate-200">{allPicks.length}</span> selections · fills in live as picks are made</div>
          {allPicks.length === 0 ? (
            <Card><p className="text-slate-500 text-center py-8">No selections yet.</p></Card>
          ) : (
            <div className="space-y-1">
              {allPicks.map((p) => {
                const t = p.draftedByTeamId ? teamOf.get(p.draftedByTeamId) : undefined;
                const origId = (p.overallPick ?? 0) > PICKS_PER_ROUND ? originalOwnerOf(p.overallPick!) : undefined;
                const orig = origId && origId !== p.draftedByTeamId ? teamOf.get(origId) : undefined;
                const newRound = (p.overallPick ?? 0) % PICKS_PER_ROUND === 1;
                return (
                  <div key={p.id}>
                    {newRound && <div className="text-[10px] uppercase tracking-wider text-slate-600 pt-2 pb-1 px-1">Round {Math.ceil((p.overallPick ?? 0) / PICKS_PER_ROUND)}</div>}
                    <div className="flex items-center gap-3 rounded-lg border border-slate-800/70 bg-slate-900/40 px-3 py-1.5">
                      <span className="w-8 text-center text-sm font-bold text-slate-500 tabular-nums">{p.overallPick}</span>
                      {t?.logoUrl && <img src={t.logoUrl} alt="" className="w-6 h-6 object-contain" />}
                      {orig?.logoUrl && <span className="flex items-center text-slate-600 text-[10px]">(<img src={orig.logoUrl} alt="" className="w-3.5 h-3.5 object-contain" />)</span>}
                      <span className="mr-0.5">{countryFlag(p.country)}</span>
                      <EpHoverName player={{ name: p.name, position: p.position, country: p.country, shoots: p.shoots, heightIn: p.heightIn, weightLb: p.weightLb, amateurLeague: p.amateurLeague, amateurClub: p.amateurClub, flag: countryFlag(p.country) }} className="font-medium text-slate-100 cursor-help">{p.name}</EpHoverName>
                      <span className={`text-xs ${posColor[p.position] ?? "text-slate-400"}`}>{p.position}</span>
                      <span className="ml-auto text-xs text-slate-500 truncate">{t?.code}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : roundComplete ? (
        <div>
          <div className="text-sm text-slate-400 mb-2">Round {round} — <span className="text-emerald-400">complete</span> · {roundPicks.length} selections</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {roundPicks.map((p) => {
              const t = p.draftedByTeamId ? teamOf.get(p.draftedByTeamId) : undefined;
              // original owner only for rounds 2-7 (round 1 ran on the real draft
              // order/lottery, not our reverse-standings slots, so we can't derive it)
              const origId = (p.overallPick ?? 0) > PICKS_PER_ROUND ? originalOwnerOf(p.overallPick!) : undefined;
              const orig = origId && origId !== p.draftedByTeamId ? teamOf.get(origId) : undefined;
              return (
                <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2">
                  <span className="w-8 text-center text-sm font-bold text-slate-500">{p.overallPick}</span>
                  <span className="flex items-center gap-1">
                    {t?.logoUrl && <img src={t.logoUrl} alt="" className="w-7 h-7 object-contain" />}
                    {orig?.logoUrl && <span className="flex items-center text-slate-600 text-xs">(<img src={orig.logoUrl} alt="" className="w-4 h-4 object-contain mx-0.5" />)</span>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-100 truncate">
                      <EpHoverName player={{ name: p.name, position: p.position, country: p.country, shoots: p.shoots, heightIn: p.heightIn, weightLb: p.weightLb, amateurLeague: p.amateurLeague, amateurClub: p.amateurClub, flag: countryFlag(p.country) }} className="cursor-help">
                        <span className="mr-1">{countryFlag(p.country)}</span>{p.name} <span className={`text-xs ${posColor[p.position] ?? "text-slate-400"}`}>{p.position}</span>
                      </EpHoverName>
                    </div>
                    <div className="text-xs text-slate-500 truncate">{t?.name ?? "—"} · {p.amateurLeague ?? p.country ?? ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="text-sm text-slate-400">Round {round} · picks <b className="text-slate-200">{roundLo}–{roundHi}</b></div>
          {/* on the clock / admin controls */}
          {isLiveRound && currentSlot && onClockTeam ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
              <div className="flex items-center gap-3">
                {onClockTeam.logoUrl && <img src={onClockTeam.logoUrl} alt="" className="w-9 h-9 object-contain" />}
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-amber-400/90">On the clock · pick #{state.currentPick}</div>
                  <div className="font-bold text-white flex items-center gap-1.5">
                    {onClockTeam.name}
                    {currentSlot.pickerTeamId !== currentSlot.originalTeamId && teamOf.get(currentSlot.originalTeamId)?.logoUrl && (
                      <span className="flex items-center text-amber-200/50 text-sm font-normal">(<img src={teamOf.get(currentSlot.originalTeamId)!.logoUrl!} alt="" className="w-5 h-5 object-contain mx-0.5" />)</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-5">
                <div className="text-xs text-amber-200/70">{canPick ? "Your pick — choose below." : "Waiting for their selection…"}</div>
                {pickDeadline && <DraftPickTimer deadline={pickDeadline} />}
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-400">Round {round} — {state.liveRound === round ? "round complete" : "not open yet."} {admin ? "" : "The admin opens each round."}</div>
          )}

          {admin && <DraftRoundStarter round={round} live={isLiveRound} status={state.status} />}

          <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_340px]">
            {/* draft order for this round */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 flex flex-col max-h-[560px]">
              <div className="px-3 py-2.5 border-b border-slate-800 text-sm font-semibold text-slate-200">Draft Order · R{round}</div>
              <div className="overflow-y-auto p-1.5 space-y-0.5">
                {roundOrder.map((p) => {
                  const picker = teamOf.get(p.pickerTeamId);
                  const orig = p.pickerTeamId !== p.originalTeamId ? teamOf.get(p.originalTeamId) : undefined;
                  const picked = draftedByPick.get(p.overallPick);
                  const current = isLiveRound && p.overallPick === state.currentPick;
                  return (
                    <div key={p.overallPick} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${current ? "bg-amber-500/15 ring-1 ring-amber-500/40" : picked ? "opacity-60" : "hover:bg-slate-800/40"}`}>
                      <span className="w-6 text-right text-xs tabular-nums text-slate-500">{p.overallPick}</span>
                      {picker?.logoUrl && <img src={picker.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />}
                      <span className="min-w-0 flex-1 truncate text-xs flex items-center gap-1">
                        {picked ? <span className="text-slate-300 truncate">{picked.name}</span> : deferredSources.has(p.overallPick) ? <span className="text-red-400/70 line-through">{picker?.code} → deferred</span> : current ? <span className="text-amber-300 font-medium">on the clock</span> : <span className="text-slate-500">{picker?.code}</span>}
                        {orig?.logoUrl && <span className="flex items-center text-slate-600 text-[10px] shrink-0">(<img src={orig.logoUrl} alt="" className="w-3.5 h-3.5 object-contain" />)</span>}
                      </span>
                    </div>
                  );
                })}

                {deferredPicks.length > 0 && (
                  <div className="pt-1.5 mt-1 border-t border-slate-800">
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-red-400/70">Deferred to end · missed clock</div>
                    {deferredPicks.map((p) => {
                      const picker = teamOf.get(p.pickerTeamId);
                      const picked = draftedByPick.get(p.overallPick);
                      const current = isLiveRound && p.overallPick === state.currentPick;
                      return (
                        <div key={p.overallPick} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${current ? "bg-amber-500/15 ring-1 ring-amber-500/40" : picked ? "opacity-60" : "hover:bg-slate-800/40"}`}>
                          <span className="w-6 text-right text-xs tabular-nums text-slate-500">{p.overallPick}</span>
                          {picker?.logoUrl && <img src={picker.logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />}
                          <span className="min-w-0 flex-1 truncate text-xs">
                            {picked ? <span className="text-slate-300">{picked.name}</span> : current ? <span className="text-amber-300 font-medium">on the clock</span> : <span className="text-slate-500">{picker?.code} · was #{p.sourcePick}</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <DraftAvailableBoard prospects={board} canPick={canPick} onClock={currentSlot && onClockTeam ? { teamName: onClockTeam.name, teamLogo: onClockTeam.logoUrl, pick: state.currentPick } : undefined} />
              {canPick && currentSlot && <OffBoardPickForm pick={state.currentPick} />}
              {admin && <OffBoardVerifyPanel picks={offBoardPicks} />}
            </div>
            <DraftChat canChat={me != null} myTeamId={me} />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
