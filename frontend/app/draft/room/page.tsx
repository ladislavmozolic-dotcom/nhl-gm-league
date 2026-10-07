import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { effectiveOrder, reverseStandingsOrder } from "@/lib/draft-order";
import { countryFlag } from "@/lib/flags";
import DraftAvailableBoard, { type BoardProspect } from "@/components/DraftAvailableBoard";
import DraftQueuePanel, { type QueueItem } from "@/components/DraftQueuePanel";
import DraftIntelCard from "@/components/DraftIntelCard";
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
import { autoOpenRound1IfDue, draftRound1OpensAt } from "@/lib/draft-schedule";

export const dynamic = "force-dynamic";

const ROUNDS = [1, 2, 3, 4, 5, 6, 7];
const posColor: Record<string, string> = { C: "text-sky-400", LW: "text-emerald-400", RW: "text-emerald-400", D: "text-amber-400", G: "text-rose-400" };

export default async function DraftRoomPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const sp = await searchParams;
  const DRAFT_YEAR = await currentDraftYear();
  const src = await currentDraftSourceWhere();
  await autoOpenRound1IfDue(DRAFT_YEAR);
  const round1Opens = draftRound1OpensAt(DRAFT_YEAR);

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
  const bonusTeams: BonusTeam[] = teams.map((t) => ({ id: t.id, code: t.code ?? "", name: t.name }));
  // active club count — the live basis for pick-number arithmetic (was a hardcoded 32)
  const ppr = revStd.length;
  // original owner of any overall pick = the team at that fixed worst-first slot
  const originalOwnerOf = (overallPick: number) => revStd[(overallPick - 1) % ppr];
  const state = stateRaw ?? { liveRound: 0, currentPick: 1, status: "IDLE" as string };
  const fullView = sp.round === "full"; // Default landing is Round 1 / live round, "full" is opt-in
  // extra rounds (8, 9, …) exist once the admin awards bonus picks
  const bonusRounds = [...new Set(order.filter((p) => p.round > 7 && !p.deferred).map((p) => p.round))].sort((a, b) => a - b);
  const allRounds = [...ROUNDS, ...bonusRounds];
  const maxRound = allRounds[allRounds.length - 1] ?? 7;
  const defaultRound = state.liveRound >= 1 ? state.liveRound : 1;
  const round = Math.min(maxRound, Math.max(1, Number(sp.round) || defaultRound));
  const allPicks = [...drafted].filter((p) => p.overallPick != null).sort((a, b) => (a.overallPick ?? 0) - (b.overallPick ?? 0));

  // the selected round's pick range from the order (base rounds are 32-wide; bonus rounds vary)
  const roundSlots = order.filter((p) => p.round === round && !p.deferred).map((p) => p.overallPick).sort((a, b) => a - b);
  const roundLo = roundSlots[0] ?? (round - 1) * ppr + 1;
  const roundHi = roundSlots[roundSlots.length - 1] ?? round * ppr;
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

  // upcoming / first pick of this round if not live
  const firstSlotOfRound = order.find((p) => p.overallPick === roundLo);
  const stageTeam = onClockTeam || (firstSlotOfRound ? teamOf.get(firstSlotOfRound.pickerTeamId) : undefined);

  // draft order for the selected round (who picks from which slot)
  const draftedByPick = new Map(drafted.filter((d) => d.overallPick != null).map((d) => [d.overallPick as number, d]));
  const roundOrder = order.filter((p) => p.round === round && !p.deferred).sort((a, b) => a.overallPick - b.overallPick);
  const deferredPicks = order.filter((p) => p.deferred).sort((a, b) => a.overallPick - b.overallPick);
  const deferredSources = new Set(deferredPicks.map((p) => p.sourcePick));

  const board: BoardProspect[] = availableRaw.map((p) => ({
    id: p.id, name: p.name, position: p.position, country: p.country, shoots: p.shoots, amateurLeague: p.amateurLeague, amateurClub: p.amateurClub, flag: countryFlag(p.country),
    heightIn: p.heightIn, weightLb: p.weightLb,
  }));

  // the signed-in GM's own draft queue for this class — still-available board prospects
  // AND custom off-board entries — in rank order.
  const myQueue: QueueItem[] = me == null ? [] : (await prisma.draftRanking.findMany({
    where: { teamId: me, rank: { gt: 0 }, OR: [{ prospect: { draftYear: DRAFT_YEAR, draftedByTeamId: null, ...src } }, { draftProspectId: null, customYear: DRAFT_YEAR }] },
    orderBy: { rank: "asc" },
    select: { id: true, rank: true, tier: true, note: true, customName: true, customPos: true, prospect: { select: { id: true, name: true, position: true, country: true } } },
  })).map((r) => r.prospect
    ? { rankingId: r.id, prospectId: r.prospect.id, custom: false, rank: r.rank, name: r.prospect.name, position: r.prospect.position, flag: countryFlag(r.prospect.country), tier: r.tier, note: r.note }
    : { rankingId: r.id, prospectId: null, custom: true, rank: r.rank, name: r.customName ?? "—", position: r.customPos ?? "—", flag: "✍️", tier: r.tier, note: r.note });

  return (
    <div className="py-2">
      <DraftTicker year={DRAFT_YEAR} />
      <DraftAnnouncer year={DRAFT_YEAR} />
      <div className="space-y-6 mt-3">
      <PageHeader title={`${DRAFT_YEAR} Draft Room`} subtitle={`Real NHL Central Scouting class · ${drafted.length} picked · ${availableRaw.length} available`} />

      {/* round switcher */}
      <div className="bg-[#0b1120] border border-slate-800 rounded-2xl p-3 shadow-xl">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Select round:</span>
          <div className="flex items-center gap-2 text-xs">
            <Link href="/around-the-world/draft" className="px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 font-bold hover:bg-amber-500/20 transition-colors">
              🌍 Draft Board
            </Link>
            {me != null && (
              <Link href="/draft/rankings" className="px-2.5 py-1 rounded-lg border border-slate-800 bg-slate-900/80 text-slate-300 font-semibold hover:border-slate-700 transition-colors">
                🎯 Moje poradie
              </Link>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scroll">
          <Link
            href="/draft/room?round=full"
            className={`shrink-0 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              fullView
                ? "bg-sky-500 text-white shadow-md shadow-sky-500/30"
                : "bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
            }`}
          >
            Full Draft
          </Link>
          {allRounds.map((r) => {
            const slots = order.filter((p) => p.round === r && !p.deferred);
            const done = slots.length > 0 && slots.every((p) => draftedByPick.has(p.overallPick));
            const live = state.status === "LIVE" && state.liveRound === r;
            const active = !fullView && r === round;
            return (
              <Link
                key={r}
                href={`/draft/room?round=${r}`}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                  active
                    ? "bg-sky-500 text-white shadow-md shadow-sky-500/30"
                    : r > 7
                    ? "border border-amber-700/50 bg-amber-900/20 text-amber-200 hover:border-amber-600"
                    : "bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700"
                }`}
              >
                <span>{r}. Kolo{r > 7 && " ★"}</span>
                {live && <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black uppercase">LIVE</span>}
                {done && !live && <span className="text-emerald-400 font-bold text-xs">✓</span>}
              </Link>
            );
          })}
        </div>
      </div>

      {round1Opens && Date.now() < round1Opens.getTime() && (
        <div className="rounded-xl border border-blue-700/40 bg-blue-950/20 px-4 py-3 text-sm text-slate-300">
          🗓️ The draft starts <b>{round1Opens.toLocaleString("en-GB", { timeZone: "Europe/Bratislava", dateStyle: "long", timeStyle: "short" })}</b> — round 1 opens automatically.
        </div>
      )}
      {admin && <BonusPickManager teams={bonusTeams} bonus={bonusRows} />}

      {fullView ? (
        <div>
          <div className="text-sm text-slate-400 mb-2">Full Draft — <span className="text-slate-200 font-bold">{allPicks.length}</span> picks · updated live</div>
          {state.status === "LIVE" && (
            <Link
              href={`/draft/room?round=${state.liveRound}`}
              className="mb-4 flex items-center justify-between gap-3 rounded-2xl border-2 border-amber-500/40 bg-gradient-to-r from-amber-950/30 via-[#0b1120] to-slate-900 px-5 py-3.5 text-sm text-amber-200 hover:border-amber-500 shadow-xl transition-all"
            >
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                <span className="font-bold text-white">Prebieha {state.liveRound}. Kolo</span>
                {onClockTeam && (
                  <span className="text-slate-300 text-xs">— On the clock: <strong className="text-amber-400">{onClockTeam.name}</strong> (pick #{state.currentPick})</span>
                )}
              </div>
              <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/40">
                Open Round {state.liveRound} →
              </span>
            </Link>
          )}
          {allPicks.length === 0 ? (
            <p className="text-sm text-slate-500 mb-3">No picks have been made yet.</p>
          ) : (
            <div className="space-y-1">
              {allPicks.map((p) => {
                const t = p.draftedByTeamId ? teamOf.get(p.draftedByTeamId) : undefined;
                const origId = (p.overallPick ?? 0) > ppr ? originalOwnerOf(p.overallPick!) : undefined;
                const orig = origId && origId !== p.draftedByTeamId ? teamOf.get(origId) : undefined;
                const newRound = (p.overallPick ?? 0) % ppr === 1;
                return (
                  <div key={p.id}>
                    {newRound && <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 pt-3 pb-1 px-1">{Math.ceil((p.overallPick ?? 0) / ppr)}. KOLO</div>}
                    <div className="flex items-center gap-3 rounded-xl border border-slate-800/70 bg-slate-900/40 hover:bg-slate-900/70 px-3 py-2 transition-colors">
                      <span className="w-8 text-center text-sm font-bold text-slate-500 tabular-nums font-mono">#{p.overallPick}</span>
                      {t?.logoUrl && (
                        <span className="inline-flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 28, height: 28, minWidth: 28 }}>
                          <img src={t.logoUrl} alt="" className="object-contain" style={{ width: 20, height: 20, maxWidth: 20, maxHeight: 20 }} />
                        </span>
                      )}
                      {orig?.logoUrl && (
                        <span className="flex items-center text-slate-600 text-[10px]">
                          (<img src={orig.logoUrl} alt="" className="w-3.5 h-3.5 object-contain inline mx-0.5" />)
                        </span>
                      )}
                      <span className="mr-0.5">{countryFlag(p.country)}</span>
                      <EpHoverName player={{ name: p.name, position: p.position, country: p.country, shoots: p.shoots, heightIn: p.heightIn, weightLb: p.weightLb, amateurLeague: p.amateurLeague, amateurClub: p.amateurClub, flag: countryFlag(p.country) }} className="font-bold text-slate-100 hover:text-sky-300 transition-colors cursor-help">{p.name}</EpHoverName>
                      <span className={`text-xs font-semibold ${posColor[p.position] ?? "text-slate-400"}`}>{p.position}</span>
                      <span className="ml-auto text-xs text-slate-500 font-mono truncate">{t?.code}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-5">
            <div className="text-sm text-slate-400 mb-2">Draft class — <span className="text-slate-200">{board.length}</span> players available · board order</div>
            <DraftAvailableBoard prospects={board} canPick={false} />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Draft Stage Hero Banner: On-the-clock podium if live, otherwise prominent Stage Hero */}
          {isLiveRound && currentSlot && onClockTeam ? (
            <div className="relative overflow-hidden rounded-3xl border-2 border-amber-500/50 bg-gradient-to-br from-[#10192e] via-[#0b1120] to-[#070b12] p-5 sm:p-6 shadow-2xl">
              <div className="absolute -top-16 -left-16 w-64 h-64 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -top-16 -right-16 w-64 h-64 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-slate-800/90 border-2 border-amber-500/40 p-2 flex items-center justify-center shadow-xl shadow-amber-500/10 shrink-0" style={{ width: 68, height: 68, minWidth: 68 }}>
                    {onClockTeam.logoUrl ? (
                      <img src={onClockTeam.logoUrl} alt="" className="object-contain filter drop-shadow" style={{ width: 48, height: 48, maxWidth: 48, maxHeight: 48 }} />
                    ) : (
                      <span className="text-base font-black text-amber-400">{onClockTeam.code}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                        NA RADE · ON THE CLOCK
                      </span>
                      <span className="text-xs text-slate-400 font-mono">ROUND {round} · PICK #{state.currentPick}</span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 mt-1">
                      <span>{onClockTeam.name}</span>
                      {currentSlot.pickerTeamId !== currentSlot.originalTeamId && teamOf.get(currentSlot.originalTeamId)?.logoUrl && (
                        <span className="flex items-center text-slate-400 text-xs font-normal">
                          (originally <img src={teamOf.get(currentSlot.originalTeamId)!.logoUrl!} alt="" className="object-contain inline mx-1" style={{ width: 16, height: 16, maxWidth: 16, maxHeight: 16 }} />)
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-amber-300/80 font-medium mt-0.5 block">
                      {canPick ? "Your pick — choose a player from the list below" : "Waiting for the team to pick…"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl px-5 py-3 shadow-inner">
                  {pickDeadline && (
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Time remaining</span>
                      <div className="text-xl sm:text-2xl font-black font-mono text-amber-400 flex items-center gap-1.5 mt-0.5">
                        <DraftPickTimer deadline={pickDeadline} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-[#10192e] via-[#0b1120] to-[#070b12] p-5 sm:p-6 shadow-2xl">
              <div className="absolute -top-16 -left-16 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -top-16 -right-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
                <div className="flex items-center gap-4">
                  <div className="rounded-2xl bg-slate-800/90 border border-slate-700/80 p-2 flex items-center justify-center shadow-xl shrink-0" style={{ width: 68, height: 68, minWidth: 68 }}>
                    {stageTeam?.logoUrl ? (
                      <img src={stageTeam.logoUrl} alt="" className="object-contain filter drop-shadow" style={{ width: 48, height: 48, maxWidth: 48, maxHeight: 48 }} />
                    ) : (
                      <span className="text-base font-black text-slate-400">{stageTeam?.code ?? "NHL"}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-sm border ${
                        roundComplete
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : state.status === "LIVE"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                          : "bg-sky-500/20 text-sky-300 border-sky-500/40"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${roundComplete ? "bg-emerald-400" : state.status === "LIVE" ? "bg-amber-400 animate-ping" : "bg-sky-400"}`} />
                        {roundComplete
                          ? `ROUND ${round} COMPLETE`
                          : state.status === "LIVE"
                          ? `DRAFT LIVE IN ROUND ${state.liveRound}`
                          : `READY · ROUND ${round}`}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {roundComplete ? `${roundPicks.length}/${roundSlots.length} PICKS DONE` : `FIRST PICK OF THE ROUND: #${firstSlotOfRound?.overallPick ?? roundLo}`}
                      </span>
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-white flex items-center gap-2 mt-1">
                      <span>{stageTeam ? stageTeam.name : `${DRAFT_YEAR} NHL Entry Draft`}</span>
                      {firstSlotOfRound && firstSlotOfRound.pickerTeamId !== firstSlotOfRound.originalTeamId && teamOf.get(firstSlotOfRound.originalTeamId)?.logoUrl && (
                        <span className="flex items-center text-slate-400 text-xs font-normal">
                          (originally <img src={teamOf.get(firstSlotOfRound.originalTeamId)!.logoUrl!} alt="" className="object-contain inline mx-1" style={{ width: 16, height: 16, maxWidth: 16, maxHeight: 16 }} />)
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 font-medium mt-0.5 block">
                      {roundComplete
                        ? `All picks in round ${round} have been submitted.`
                        : state.status === "LIVE"
                        ? `Pick #${state.currentPick} is in progress. You can switch to the live round ${state.liveRound}.`
                        : round1Opens && Date.now() < round1Opens.getTime()
                        ? `Round starts: ${round1Opens.toLocaleString("en-GB", { timeZone: "Europe/Bratislava", dateStyle: "long", timeStyle: "short" })}`
                        : "The round is not open yet. An administrator will open it, or it will start on schedule."}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3 shadow-inner">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Available in class</span>
                    <span className="text-base font-black text-slate-200">{availableRaw.length} talentov</span>
                  </div>
                  <div className="w-px h-8 bg-slate-800 hidden sm:block" />
                  <div className="text-left md:text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">Picks in round</span>
                    <span className="text-base font-black text-slate-200">{roundPicks.length} / {roundSlots.length}</span>
                  </div>
                  {state.status === "LIVE" && (
                    <Link
                      href={`/draft/room?round=${state.liveRound}`}
                      className="ml-2 px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black text-xs hover:bg-amber-400 transition-colors shadow-md shadow-amber-500/20 shrink-0"
                    >
                      Go to LIVE ⚡
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}

          {admin && <DraftRoundStarter round={round} live={isLiveRound} status={state.status} />}

          <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
            {/* draft order for this round */}
            <div className="rounded-2xl border border-slate-800 bg-[#0b1120] flex flex-col max-h-[580px] shadow-xl">
              <div className="px-3.5 py-3 border-b border-slate-800 text-xs font-black uppercase tracking-wider text-slate-300">Pick order · Round {round}</div>
              <div className="overflow-y-auto p-2 space-y-1 custom-scroll">
                {roundOrder.map((p) => {
                  const picker = teamOf.get(p.pickerTeamId);
                  const orig = p.pickerTeamId !== p.originalTeamId ? teamOf.get(p.originalTeamId) : undefined;
                  const picked = draftedByPick.get(p.overallPick);
                  const current = isLiveRound && p.overallPick === state.currentPick;
                  return (
                    <div key={p.overallPick} className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-colors ${current ? "bg-amber-500/15 border border-amber-500/50 shadow-sm" : picked ? "opacity-60 bg-slate-900/30" : "hover:bg-slate-800/40"}`}>
                      <span className="w-6 text-right text-xs tabular-nums font-mono text-slate-500">#{p.overallPick}</span>
                      {picker?.logoUrl && (
                        <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 22, height: 22, minWidth: 22 }}>
                          <img src={picker.logoUrl} alt="" className="object-contain" style={{ width: 16, height: 16, maxWidth: 16, maxHeight: 16 }} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-xs flex items-center gap-1">
                        {picked ? <span className="text-slate-300 font-medium truncate">{picked.name}</span> : deferredSources.has(p.overallPick) ? <span className="text-red-400/70 line-through">{picker?.code} → deferred</span> : current ? <span className="text-amber-300 font-black">NA RADE</span> : <span className="text-slate-400 font-semibold">{picker?.code}</span>}
                        {orig?.logoUrl && <span className="flex items-center text-slate-600 text-[10px] shrink-0">(<img src={orig.logoUrl} alt="" className="object-contain" style={{ width: 14, height: 14, maxWidth: 14, maxHeight: 14 }} />)</span>}
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
                          <span className="w-6 text-right text-xs tabular-nums text-slate-500">#{p.overallPick}</span>
                          {picker?.logoUrl && (
                            <span className="inline-flex items-center justify-center rounded bg-slate-800 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 22, height: 22, minWidth: 22 }}>
                              <img src={picker.logoUrl} alt="" className="object-contain" style={{ width: 16, height: 16, maxWidth: 16, maxHeight: 16 }} />
                            </span>
                          )}
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
              {roundComplete ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-800 bg-[#0b1120] p-4 shadow-xl">
                    <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-200">Players picked in round {round}</span>
                      </div>
                      <span className="text-xs font-mono text-emerald-400 font-bold">{roundPicks.length} picks</span>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 max-h-[500px] overflow-y-auto custom-scroll pr-1">
                      {roundPicks.map((p) => {
                        const t = p.draftedByTeamId ? teamOf.get(p.draftedByTeamId) : undefined;
                        const origId = (p.overallPick ?? 0) > ppr ? originalOwnerOf(p.overallPick!) : undefined;
                        const orig = origId && origId !== p.draftedByTeamId ? teamOf.get(origId) : undefined;
                        return (
                          <div key={p.id} className="flex items-center gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/50 hover:bg-slate-900/90 px-3 py-2 transition-colors">
                            <span className="w-7 text-center text-xs font-bold text-slate-500 font-mono">#{p.overallPick}</span>
                            {t?.logoUrl && (
                              <span className="inline-flex items-center justify-center rounded-lg bg-slate-800/80 border border-slate-700/60 p-0.5 shrink-0" style={{ width: 28, height: 28, minWidth: 28 }}>
                                <img src={t.logoUrl} alt="" className="object-contain" style={{ width: 20, height: 20, maxWidth: 20, maxHeight: 20 }} />
                              </span>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-slate-100 text-xs truncate">
                                <EpHoverName player={{ name: p.name, position: p.position, country: p.country, shoots: p.shoots, heightIn: p.heightIn, weightLb: p.weightLb, amateurLeague: p.amateurLeague, amateurClub: p.amateurClub, flag: countryFlag(p.country) }} className="cursor-help hover:text-sky-300 transition-colors">
                                  <span className="mr-1">{countryFlag(p.country)}</span>{p.name} <span className={`text-[10px] ${posColor[p.position] ?? "text-slate-400"}`}>{p.position}</span>
                                </EpHoverName>
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">{t?.name ?? "—"} · {p.amateurLeague ?? p.country ?? ""}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <details className="rounded-2xl border border-slate-800 bg-[#0b1120] overflow-hidden shadow-xl group">
                    <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold text-slate-300 hover:text-white transition-colors">
                      <span className="flex items-center gap-2">
                        <span className="text-slate-500 group-open:rotate-90 transition-transform">▶</span>
                        Available draft talent ({board.length} players)
                      </span>
                      <span className="text-[10px] text-slate-500">Kliknite pre zobrazenie</span>
                    </summary>
                    <div className="p-3 border-t border-slate-800">
                      <DraftAvailableBoard prospects={board} canPick={false} />
                    </div>
                  </details>
                </div>
              ) : (
                <>
                  {me != null && <DraftQueuePanel queue={myQueue} canPick={canPick} />}
                  <DraftAvailableBoard prospects={board} canPick={canPick} onClock={currentSlot && onClockTeam ? { teamName: onClockTeam.name, teamLogo: onClockTeam.logoUrl, pick: state.currentPick } : undefined} />
                  {canPick && currentSlot && <OffBoardPickForm pick={state.currentPick} />}
                  {admin && <OffBoardVerifyPanel picks={offBoardPicks} />}
                </>
              )}
            </div>
            <DraftChat canChat={me != null} myTeamId={me} />
          </div>
        </div>
      )}

      {me != null && (
        <details className="group rounded-xl border border-slate-800 bg-slate-900/40">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-200">
            <span className="text-slate-400 group-open:hidden">＋</span><span className="hidden text-slate-400 group-open:inline">－</span>
            UNHL Intelligence <span className="text-xs font-normal text-slate-500">— scouting insight for your pick</span>
          </summary>
          <div className="px-2 pb-3"><DraftIntelCard teamId={me} draftYear={DRAFT_YEAR} available={availableRaw} sourceWhere={src} /></div>
        </details>
      )}
      </div>
    </div>
  );
}
