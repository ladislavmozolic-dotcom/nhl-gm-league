import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import RosterView from "@/components/RosterView";
import { isAdmin, canManageTeam, isLoggedIn } from "@/lib/auth";
import AutoFillButton from "@/components/AutoFillButton";
import RosterTabs from "@/components/RosterTabs";
import { captaincyFromName } from "@/lib/playerName";
import { hasWorthyGoalie, MIN_GOALIE_OV, MIN_GOALIE_GP, MIN_GOALIE_GP_SVPCT } from "@/lib/goalie-rule";
import { redactAttrs } from "@/lib/player-attrs";
import { livePlayerOverall } from "@/lib/player-overall";
import { offerTwoWayFromRoster } from "../rosters/actions";
import { getLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

const isDefPos = (p: string) => /(^|\/)D(\/|$)/.test(p) || p === "D";

export default async function TeamRosterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await prisma.team.findUnique({
    where: { slug },
    include: { players: { orderBy: { overall: "desc" }, include: { goalieRating: true } } },
  });
  if (!team) notFound();

  const rt = team.league === "AHL" ? "AHL" : "NHL";
  const roster = team.players
    .filter((p) => p.rosterType === rt)
    .map((p) => ({ ...p, overall: livePlayerOverall(p) }));
  const nF = roster.filter((p) => !p.isGoalie && !isDefPos(p.position ?? "")).length;
  const nD = roster.filter((p) => !p.isGoalie && isDefPos(p.position ?? "")).length;
  const nG = roster.filter((p) => p.isGoalie).length;
  const short = [
    nF < 12 ? `${12 - nF}F` : null,
    nD < 6 ? `${6 - nD}D` : null,
    nG < 2 ? `${2 - nG}G` : null,
  ].filter(Boolean);

  const noWorthyGoalie = rt === "NHL" && !hasWorthyGoalie(roster.filter((p) => p.isGoalie));
  const affiliate =
    team.league === "NHL"
      ? await prisma.team.findFirst({
          where: { parentTeamId: team.id },
          select: {
            id: true,
            name: true,
            code: true,
            players: { where: { rosterType: "AHL" }, orderBy: { overall: "desc" }, include: { goalieRating: true } },
          },
        })
      : null;
  const admin = await isAdmin();
  const isGm = await canManageTeam(team.id);

  const lines = await prisma.teamLines.findUnique({
    where: { teamId: team.id },
    select: { forwardLines: true, defensePairs: true, situations: true },
  });
  const dressed = new Set<number>();
  if (lines) {
    for (const l of (lines.forwardLines as any[]) ?? []) for (const id of [l?.lw, l?.c, l?.rw]) if (id != null) dressed.add(id);
    for (const p of (lines.defensePairs as any[]) ?? []) for (const id of [p?.ld, p?.rd]) if (id != null) dressed.add(id);
    const others = (lines.situations as any)?.others;
    if (others?.starter != null) dressed.add(others.starter);
    if (others?.backup != null) dressed.add(others.backup);

    const byIdRoster = new Map(roster.map((p) => [p.id, p]));
    for (const id of [...dressed]) {
      const rp = byIdRoster.get(id);
      if (!rp || rp.scratched) dressed.delete(id);
    }
    const bucketOf = (p: (typeof roster)[number]) => (p.isGoalie ? "G" : isDefPos(p.position ?? "") ? "D" : "F");
    const minNeed: Record<"F" | "D" | "G", number> = { F: 12, D: 6, G: 2 };
    const have: Record<"F" | "D" | "G", number> = { F: 0, D: 0, G: 0 };
    const healthy = roster.filter((p) => (p.injuryDaysLeft ?? 0) === 0 && !p.scratched);
    for (const p of healthy) if (dressed.has(p.id)) have[bucketOf(p)]++;
    for (const b of ["F", "D", "G"] as const)
      for (const p of healthy) {
        if (have[b] >= minNeed[b]) break;
        if (bucketOf(p) === b && !dressed.has(p.id)) {
          dressed.add(p.id);
          have[b]++;
        }
      }
  }

  const capHasField = team.players.some((p) => p.captaincy === "C" || p.captaincy === "A");
  const loggedIn = await isLoggedIn();
  const rosterWithCap = roster.map((p) =>
    redactAttrs({ ...p, capRole: capHasField ? p.captaincy : captaincyFromName(p.name) }, !loggedIn)
  );
  const farmHasCapField = affiliate?.players.some((p) => p.captaincy === "C" || p.captaincy === "A") ?? false;
  const farmRoster = (affiliate?.players ?? []).map((p) =>
    redactAttrs(
      {
        ...p,
        overall: livePlayerOverall(p),
        capRole: farmHasCapField ? p.captaincy : captaincyFromName(p.name),
      },
      !loggedIn
    )
  );

  const lang = await getLang();
  const isEn = lang === "en";

  return (
    <div className="space-y-6">
      <RosterTabs slug={slug} isGm={isGm} />

      {short.length > 0 && (
        <div className="text-sm text-amber-200 bg-amber-950/40 border border-amber-800/60 rounded-2xl p-4 shadow-lg flex items-start gap-3">
          <span className="text-xl shrink-0">⚠️</span>
          <div className="flex-1">
            <b>{isEn ? "Below the minimum lineup" : "Pod minimálnym limitom zostavy"}</b> (12F / 6D / 2G) —{" "}
            {isEn ? "you own" : "v tíme máš"} <b>{nF}F · {nD}D · {nG}G</b>.
            {affiliate ? (
              isEn ? (
                <>
                  {" "}
                  The next simulation promotes the missing <b>{short.join(" · ")}</b> from the farm (
                  <b>{affiliate.name}</b>) onto this roster —{" "}
                  <b>they count against the cap and stay until you send them down</b>. Sign or trade to ice your own.
                </>
              ) : (
                <>
                  {" "}
                  Najbližšia simulácia automaticky povolá chýbajúcich <b>{short.join(" · ")}</b> z farmy (
                  <b>{affiliate.name}</b>) — <b>počítajú sa do platového stropu, kým ich nepošleš späť</b>. Podpíš alebo vymeň hráčov pre vlastnú zostavu.
                </>
              )
            ) : isEn ? (
              <>
                {" "}
                Missing <b>{short.join(" · ")}</b> — add players to field a full lineup.
              </>
            ) : (
              <>
                {" "}
                Chýba <b>{short.join(" · ")}</b> — doplň hráčov pre kompletnú zostavu.
              </>
            )}
            {admin && affiliate && (
              <div className="mt-3">
                <AutoFillButton />
              </div>
            )}
          </div>
        </div>
      )}

      {noWorthyGoalie && (
        <div className="text-sm text-rose-200 bg-rose-950/40 border border-rose-800/60 rounded-2xl p-4 shadow-lg flex items-start gap-3">
          <span className="text-xl shrink-0">🥅</span>
          <div>
            <b>{isEn ? "No worthy goalie." : "Chýba kvalifikovaný brankár."}</b>{" "}
            {isEn
              ? `League rule: every club must carry at least one goalie who is either ${MIN_GOALIE_OV}+ overall, started ${MIN_GOALIE_GP}+ real games last season, or started more than ${MIN_GOALIE_GP_SVPCT} real games at a save % above 90 — until you do, this roster isn't game-ready.`
              : `Pravidlo ligy: každý klub musí mať aspoň jedného brankára s OVR ${MIN_GOALIE_OV}+, alebo odchytaných aspoň ${MIN_GOALIE_GP}+ reálnych zápasov, prípadne viac než ${MIN_GOALIE_GP_SVPCT} zápasov s úspešnosťou nad 90% — kým to nesplníš, súpiska nie je spôsobilá na zápas.`}
          </div>
        </div>
      )}

      {/* Main Roster Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/80 ring-2 ring-blue-500/20" />
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
              {rt} {isEn ? "Roster" : "Súpiska"}
            </h2>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
              {team.code || team.name}
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {rosterWithCap.length} {isEn ? "players" : "hráčov"}
          </span>
        </div>

        <RosterView players={rosterWithCap} dressedIds={[...dressed]} hideAttrs={!loggedIn} />
      </section>

      {/* Affiliate Roster Section */}
      {affiliate && (
        <section className="space-y-4 pt-6 border-t border-slate-800">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/80 ring-2 ring-amber-500/20" />
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
                AHL {isEn ? "Roster" : "Súpiska"}
              </h2>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700/60">
                {affiliate.name}
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {farmRoster.length} {isEn ? "players" : "hráčov"}
            </span>
          </div>

          <RosterView
            players={farmRoster}
            farm
            hideAttrs={!loggedIn}
            teamSlug={isGm ? slug : undefined}
            offerTwoWayAction={isGm ? offerTwoWayFromRoster : undefined}
          />
        </section>
      )}
    </div>
  );
}
