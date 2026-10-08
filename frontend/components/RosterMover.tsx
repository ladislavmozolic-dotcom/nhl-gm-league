"use client";

import { useState, useTransition } from "react";
import PlayerLink from "@/components/PlayerLink";
import Link from "next/link";
import BackLink from "@/components/BackLink";
import { ROSTER_LIMITS, WAIVER_CAP_HIT_LIMIT, isNhlSide, type MoveRow, type RosterSide } from "@/lib/roster-rules";
import { useLang } from "@/components/LangProvider";

type Player = {
  id: number;
  name: string;
  position: string;
  overall: number;
  isGoalie: boolean;
  condition?: number | null;
  side: RosterSide;
  contractType: "ONE_WAY" | "TWO_WAY" | null;
  capHit: number;
  ahlSalary?: number | null;
  onWaivers?: boolean;
  // Rule 30/10 recall pass — riding a free (no-waivers) trip back to the farm since
  // his last AHL→NHL call-up (≤30 days AND ≤10 NHL games played since then).
  recallExempt?: boolean;
  recallDaysLeft?: number;
  recallGamesLeft?: number;
};

// Exactly the $100k farm deal → a minor-league (AHL-only) contract. Such a player
// can NEVER be on the NHL roster — dressed OR scratched. Anything else (including a
// two-way deal well below the real NHL minimum) is governed by contractType instead.
const isAhlOnly = (p: Player) => p.capHit === 100_000;

// OV badge in green, brighter the higher the rating.
const ovColor = (ov: number) =>
  ov >= 80
    ? "bg-emerald-500/30 text-emerald-200 border-emerald-400/60"
    : ov >= 70
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
    : ov >= 60
    ? "bg-emerald-600/12 text-emerald-400/90 border-emerald-600/30"
    : "bg-emerald-700/10 text-emerald-500/70 border-emerald-700/25";

// a $100k minor-league deal is the only contract that can be released to UFA
const isReleasable = (p: Player) => p.capHit === 100_000;

type Props = {
  teamName: string;
  teamSlug: string;
  fromFarmSlug?: string | null;
  affiliateName: string;
  hasAffiliate: boolean;
  players: Player[];
  onSave: (slug: string, rows: MoveRow[]) => Promise<{ ok: boolean; error?: string } | void>;
  onRelease: (slug: string, playerId: number) => Promise<{ ok: boolean; error?: string; name?: string }>;
  onWaiver: (slug: string, playerId: number) => Promise<{ ok: boolean; error?: string }>;
};

export default function RosterMover({
  teamName,
  teamSlug,
  fromFarmSlug,
  affiliateName,
  hasAffiliate,
  players,
  onSave,
  onRelease,
  onWaiver,
}: Props) {
  const lang = useLang();
  const isCs = lang === "cs";

  const [rows, setRows] = useState<Player[]>(players);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<"name" | "ov">("name");

  const release = (p: Player) => {
    if (!isReleasable(p)) return;
    const confirmMsg = isCs
      ? `Prepustiť hráča ${p.name} na trh voľných hráčov (UFA)? Opustí vašu organizáciu a ktorýkoľvek GM ho môže podpísať.`
      : `Release ${p.name} to the UFA market? He leaves your organization and any GM can sign him.`;
    if (!confirm(confirmMsg)) return;

    start(async () => {
      setErr(null);
      setNote(null);
      try {
        const r = await onRelease(teamSlug, p.id);
        if (!r.ok) {
          setErr(r.error ?? (isCs ? "Hráča sa nepodarilo prepustiť." : "Couldn't release the player."));
        } else {
          setRows((prev) => prev.filter((x) => x.id !== p.id));
          setNote(isCs ? `${r.name ?? p.name} bol prepustený na trh UFA.` : `${r.name ?? p.name} released to UFA.`);
        }
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  };

  const waiver = (p: Player) => {
    const confirmMsg = isCs
      ? `Umiestniť hráča ${p.name} na listinu waivers? Ktorýkoľvek klub si ho môže stiahnuť počas 24-hodinového okna; ak si ho nikto nevyberie, prejde na farmu (AHL).`
      : `Put ${p.name} on waivers? Any club can claim him during a one-day window; if unclaimed, he clears to your AHL affiliate.`;
    if (!confirm(confirmMsg)) return;

    start(async () => {
      setErr(null);
      setNote(null);
      try {
        const r = await onWaiver(teamSlug, p.id);
        if (!r.ok) {
          setErr(r.error ?? (isCs ? "Nepodarilo sa umiestniť hráča na waivers." : "Couldn't place him on waivers."));
        } else {
          setRows((prev) => prev.map((x) => (x.id === p.id ? { ...x, onWaivers: true } : x)));
          setNote(isCs ? `${p.name} bol umiestnený na waivers.` : `${p.name} placed on waivers.`);
        }
      } catch (e) {
        setErr((e as Error).message);
      }
    });
  };

  const byName = (a: Player, b: Player) => a.name.localeCompare(b.name);
  const byOV = (a: Player, b: Player) => b.overall - a.overall || a.name.localeCompare(b.name);
  const of = (s: RosterSide) => rows.filter((r) => r.side === s).sort(sortMode === "ov" ? byOV : byName);
  const pro = of("pro"),
    proScratched = of("pro-scratched"),
    farm = of("farm"),
    farmScratched = of("farm-scratched");
  const nhlRoster = rows.filter((r) => isNhlSide(r.side)); // dressed + scratched → cap + 23-limit
  const goalies = (l: Player[]) => l.filter((p) => p.isGoalie).length;
  const proSkaters = pro.length - goalies(pro);
  const isDef = (pos: string) => /(^|\/)D(\/|$)/.test(pos) || pos === "D";
  const fdg = (l: Player[]) => {
    const g = l.filter((p) => p.isGoalie).length;
    const d = l.filter((p) => !p.isGoalie && isDef(p.position)).length;
    const f = l.length - g - d;
    return isCs ? `${f}Ú · ${d}O · ${g}B` : `${f}F · ${d}D · ${g}G`;
  };

  const canMove = (p: Player, to: RosterSide) => {
    if (isNhlSide(to)) return !isAhlOnly(p);
    if (!isNhlSide(p.side)) return true;
    return p.contractType !== "ONE_WAY" || isAhlOnly(p) || !!p.recallExempt;
  };

  const move = (id: number, to: RosterSide) => {
    const p = rows.find((r) => r.id === id)!;
    if (!canMove(p, to)) return;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, side: to } : r)));
    setSaved(false);
    setErr(null);
  };

  const orgGoalies = goalies(nhlRoster) + goalies(farm) + goalies(farmScratched);
  const blockers: string[] = [];
  if (nhlRoster.length > ROSTER_LIMITS.proMax)
    blockers.push(
      isCs
        ? `NHL súpiska má viac ako ${ROSTER_LIMITS.proMax} hráčov (nasadení + náhradníci).`
        : `NHL roster over ${ROSTER_LIMITS.proMax} (dressed + scratched).`
    );
  if (rows.length > ROSTER_LIMITS.orgMax)
    blockers.push(
      isCs ? `Organizácia prekročila limit ${ROSTER_LIMITS.orgMax} hráčov.` : `Organization over ${ROSTER_LIMITS.orgMax} players.`
    );
  if (orgGoalies > ROSTER_LIMITS.orgMaxGoalies)
    blockers.push(
      isCs
        ? `Organizácia má viac ako ${ROSTER_LIMITS.orgMaxGoalies} brankárov.`
        : `Organization over ${ROSTER_LIMITS.orgMaxGoalies} goalies.`
    );

  const warnings: string[] = [];
  if (proSkaters < ROSTER_LIMITS.proMinSkaters)
    warnings.push(
      isCs
        ? `V NHL zostave chýba do počtu ${ROSTER_LIMITS.proMinSkaters} korčuliarov — v čase zápasu ich farma automaticky doplní.`
        : `Dressed NHL short of ${ROSTER_LIMITS.proMinSkaters} skaters — the farm auto-fills at game time.`
    );
  if (goalies(pro) < ROSTER_LIMITS.proMinGoalies)
    warnings.push(
      isCs
        ? `V NHL zostave chýba do počtu ${ROSTER_LIMITS.proMinGoalies} brankárov — v čase zápasu ich farma automaticky doplní.`
        : `Dressed NHL short of ${ROSTER_LIMITS.proMinGoalies} goalies — the farm auto-fills at game time.`
    );

  const autoRoster = () => {
    const byOV = (a: Player, b: Player) => b.overall - a.overall;
    const sk = rows.filter((r) => !r.isGoalie);
    const gk = rows.filter((r) => r.isGoalie);
    const forcedUp = (p: Player) => p.contractType === "ONE_WAY" && !isAhlOnly(p);
    const proPool = (pool: Player[], n: number) => {
      const forced = pool.filter(forcedUp);
      const rest = pool.filter((p) => !forcedUp(p) && !isAhlOnly(p)).sort(byOV);
      return [...forced, ...rest].slice(0, Math.max(n, forced.length)).map((p) => p.id);
    };
    const proIds = new Set([...proPool(sk, ROSTER_LIMITS.proMinSkaters), ...proPool(gk, ROSTER_LIMITS.proMinGoalies)]);
    const remSk = sk.filter((p) => !proIds.has(p.id)).sort(byOV);
    const remGk = gk.filter((p) => !proIds.has(p.id)).sort(byOV);
    const farmIds = new Set([...remSk.slice(0, 18), ...remGk.slice(0, 2)].map((p) => p.id));
    setRows((prev) =>
      prev.map((p) => ({ ...p, side: proIds.has(p.id) ? "pro" : farmIds.has(p.id) ? "farm" : "farm-scratched" }))
    );
    setSaved(false);
    setErr(null);
  };

  const save = () =>
    start(async () => {
      setErr(null);
      try {
        const r = await onSave(
          teamSlug,
          rows.map((m) => ({ id: m.id, side: m.side, contractType: m.contractType }))
        );
        if (r && !r.ok) setErr(r.error ?? (isCs ? "Súpisku sa nepodarilo uložiť." : "Couldn't save the roster."));
        else setSaved(true);
      } catch (e) {
        setErr((e as Error).message);
      }
    });

  const MoveBtn = ({ p, to, label }: { p: Player; to: RosterSide; label: string }) => (
    <button
      onClick={() => move(p.id, to)}
      disabled={!canMove(p, to)}
      title={
        !canMove(p, to)
          ? isNhlSide(to)
            ? isCs
              ? "Iba AHL / $100k zmluva — nemôže byť na NHL súpiske"
              : "AHL-only / $100k contract — can't be on the NHL roster"
            : isCs
            ? "Jednocestnú zmluvu nie je možné poslať priamo na farmu"
            : "One-way contracts can't be sent down"
          : ""
      }
      className="text-[11px] px-2 py-0.5 rounded bg-slate-750 hover:bg-slate-700 disabled:opacity-30 whitespace-nowrap transition-colors"
    >
      {label}
    </button>
  );

  const Row = ({ p }: { p: Player }) => {
    const oneWay = p.contractType === "ONE_WAY";
    const ahlOnly = isAhlOnly(p);
    const tooExpensive = p.capHit > WAIVER_CAP_HIT_LIMIT;
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800/60 text-sm hover:bg-slate-800/30 transition-colors">
        <span className={`shrink-0 w-9 text-center tabular-nums font-bold text-sm px-1 py-0.5 rounded border ${ovColor(p.overall)}`}>
          {p.overall}
        </span>
        <span className="flex-1 min-w-0 truncate">
          <PlayerLink id={p.id} name={p.name} className="font-medium" />
          <span className="text-slate-500 text-xs ml-1.5">{p.position}</span>
        </span>
        {p.isGoalie && p.condition != null && (
          <span
            title={
              isCs
                ? "Kondícia brankára — pod ~95% nemôže začať zápas; simulátor nechá unaveného chytať len v núdzi"
                : "Goalie condition — below ~95 he can't start; the sim rests a tired starter"
            }
            className={`shrink-0 text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded border border-slate-700 ${
              p.condition >= 98
                ? "text-emerald-400"
                : p.condition >= 95
                ? "text-green-400"
                : p.condition >= 90
                ? "text-amber-400"
                : "text-red-400"
            }`}
          >
            {isCs ? "KOND" : "CON"} {Math.round(p.condition)}%
          </span>
        )}
        {ahlOnly ? (
          <span
            title={
              isCs
                ? "Zmluva pre farmu (iba AHL) — pod minimom NHL, nemožno povolať do prvého tímu"
                : "Minor-league (AHL-only) contract — below the NHL minimum salary, can't be called up"
            }
            className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-600/50 text-emerald-400"
          >
            {isCs ? "Iba AHL" : "AHL only"}
          </span>
        ) : (
          <span
            title={
              isCs
                ? oneWay
                  ? "Jednocestná zmluva — nemožno poslať na farmu priamo bez waivers"
                  : p.ahlSalary != null
                  ? `Dvojcestná zmluva — $${p.capHit.toLocaleString("en-US")} NHL / $${p.ahlSalary.toLocaleString("en-US")} AHL`
                  : `Zmluva — $${p.capHit.toLocaleString("en-US")}`
                : oneWay
                ? "One-way contract — can't be sent to the farm"
                : p.ahlSalary != null
                ? `Two-way contract — $${p.capHit.toLocaleString("en-US")} NHL / $${p.ahlSalary.toLocaleString("en-US")} AHL`
                : `Legacy contract — $${p.capHit.toLocaleString("en-US")} on NHL and AHL roster`
            }
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              oneWay ? "border-amber-600/60 text-amber-400" : "border-slate-700 text-slate-400"
            }`}
          >
            {oneWay ? "1-way" : "2-way"}
          </span>
        )}
        {oneWay && !ahlOnly && p.recallExempt && (p.side === "pro" || p.side === "pro-scratched") && (
          <span
            title={
              isCs
                ? `Výnimka z waivers — povolaný z AHL v posledných 30 dňoch / 10 zápasoch: zostáva ${p.recallDaysLeft}d / ${p.recallGamesLeft}z do opätovnej nutnosti waivers`
                : `Recall pass — sent down from the AHL within the last 30 days/10 games gets him back down freely: ${p.recallDaysLeft}d / ${p.recallGamesLeft}g left before he needs waivers again`
            }
            className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-600/50 text-emerald-400 whitespace-nowrap"
          >
            {isCs ? "🔓 Výnimka" : "🔓 Recall pass"}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          {oneWay && p.onWaivers && (p.side === "pro" || p.side === "pro-scratched") && (
            <span
              title={
                isCs
                  ? "Čaká na uzavretie 24-hodinového okna waivers — pozrite stránku Waivers"
                  : "Waiting for the one-day waiver window to close — check the Waivers page"
              }
              className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-amber-600/50 text-amber-400 whitespace-nowrap"
            >
              {isCs ? "⏳ Na waivers" : "⏳ On Waivers"}
            </span>
          )}
          {p.side === "pro" && (
            <>
              <MoveBtn p={p} to="pro-scratched" label={isCs ? "Posadiť" : "Scratch"} />
              {oneWay && !ahlOnly && !p.recallExempt ? (
                !p.onWaivers && (
                  <button
                    onClick={() => waiver(p)}
                    disabled={pending || tooExpensive}
                    title={
                      tooExpensive
                        ? isCs
                          ? `Príliš drahý hráč na waivers (nad $${(WAIVER_CAP_HIT_LIMIT / 1e6).toFixed(1)}M cap hit) — nemožno poslať na farmu`
                          : `Too valuable to clear waivers (over $${(WAIVER_CAP_HIT_LIMIT / 1e6).toFixed(1)}M cap hit) — he can't be sent to the farm`
                        : isCs
                        ? "Jednocestné zmluvy musia prejsť waivers pred odchodom na farmu"
                        : "One-way contracts must clear waivers before they can be sent to the farm"
                    }
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 whitespace-nowrap transition-colors"
                  >
                    {isCs ? "Farma/Waivers" : "Farm/Waivers"}
                  </button>
                )
              ) : (
                <MoveBtn p={p} to="farm" label={isCs ? "↓ Farma" : "↓ Farm"} />
              )}
            </>
          )}
          {p.side === "pro-scratched" && (
            <>
              <MoveBtn p={p} to="pro" label={isCs ? "Nasadiť" : "Dress"} />
              {oneWay && !ahlOnly && !p.recallExempt ? (
                !p.onWaivers && (
                  <button
                    onClick={() => waiver(p)}
                    disabled={pending || tooExpensive}
                    title={
                      tooExpensive
                        ? isCs
                          ? `Príliš drahý hráč na waivers (nad $${(WAIVER_CAP_HIT_LIMIT / 1e6).toFixed(1)}M cap hit) — nemožno poslať na farmu`
                          : `Too valuable to clear waivers (over $${(WAIVER_CAP_HIT_LIMIT / 1e6).toFixed(1)}M cap hit) — he can't be sent to the farm`
                        : isCs
                        ? "Jednocestné zmluvy musia prejsť waivers pred odchodom na farmu"
                        : "One-way contracts must clear waivers before they can be sent to the farm"
                    }
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 whitespace-nowrap transition-colors"
                  >
                    {isCs ? "Farma/Waivers" : "Farm/Waivers"}
                  </button>
                )
              ) : (
                <MoveBtn p={p} to="farm" label={isCs ? "↓ Farma" : "↓ Farm"} />
              )}
            </>
          )}
          {p.side === "farm" && (
            <>
              <MoveBtn p={p} to="pro" label={isCs ? "↑ NHL" : "↑ Pro"} />
              <MoveBtn p={p} to="farm-scratched" label={isCs ? "Posadiť" : "Scratch"} />
            </>
          )}
          {p.side === "farm-scratched" && (
            <>
              <MoveBtn p={p} to="pro" label={isCs ? "↑ NHL" : "↑ Pro"} />
              <MoveBtn p={p} to="farm" label={isCs ? "Nasadiť" : "Dress"} />
              <button
                onClick={() => release(p)}
                disabled={!isReleasable(p) || pending}
                title={
                  isReleasable(p)
                    ? isCs
                      ? "Prepustiť tohto $100k hráča na trh voľných hráčov (UFA)"
                      : "Release this $100k minor-league player to the UFA market"
                    : isCs
                    ? "Prepustiť možno iba $100k farmársku zmluvu"
                    : "Only a $100k minor-league contract can be released"
                }
                className="text-[11px] px-2 py-0.5 rounded bg-red-900/70 hover:bg-red-800 text-red-200 disabled:opacity-25 whitespace-nowrap transition-colors"
              >
                {isCs ? "Prepustiť" : "Release"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const Col = ({ title, sub, list, warn }: { title: string; sub: string; list: Player[]; warn?: boolean }) => (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-md backdrop-blur">
      <div className={`px-3.5 py-2.5 border-b border-slate-800 ${warn ? "bg-red-950/40" : "bg-slate-800/40"}`}>
        <div className="font-bold text-sm text-slate-100">{title}</div>
        <div className="text-[11px] text-slate-400 mt-0.5">{sub}</div>
      </div>
      <div className="max-h-[42vh] overflow-y-auto divide-y divide-slate-800/30">
        {list.length === 0 && (
          <div className="px-4 py-6 text-center text-slate-500 text-xs italic">
            {isCs ? "Žiadni hráči" : "empty"}
          </div>
        )}
        {list.map((p) => (
          <Row key={p.id} p={p} />
        ))}
      </div>
    </div>
  );

  if (!hasAffiliate)
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-2">
          {teamName} — {isCs ? "Pohyby v súpiske" : "Rosters"}
        </h1>
        <p className="text-slate-400">
          {isCs ? "Tento klub nemá žiadnu AHL farmu na presun hráčov." : "This team has no AHL affiliate to move players between."}
        </p>
      </div>
    );

  return (
    <div className="w-full px-6 pb-28">
      <div className="mb-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">
            {teamName} — {isCs ? "Pohyby v súpiske" : "Rosters"}
          </h1>
          <div className="flex items-center gap-1.5 text-xs bg-slate-900/80 border border-slate-800 px-2 py-1 rounded-lg">
            <span className="text-slate-400 mr-0.5">{isCs ? "Zoradiť:" : "Sort:"}</span>
            <button
              onClick={() => setSortMode("name")}
              className={`px-2.5 py-0.5 rounded-md font-semibold transition-colors ${
                sortMode === "name" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              A–Z
            </button>
            <button
              onClick={() => setSortMode("ov")}
              className={`px-2.5 py-0.5 rounded-md font-semibold transition-colors ${
                sortMode === "ov" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              OV
            </button>
          </div>
        </div>
        <div className="flex gap-3 text-sm mt-1.5 items-center">
          <BackLink fallback={`/teams/${fromFarmSlug ?? teamSlug}`} label={isCs ? "tím" : "team"} />
          <Link href={`/teams/${fromFarmSlug ?? teamSlug}/lines`} className="text-slate-400 hover:text-blue-400 transition-colors">
            {isCs ? "Zostavy →" : "Lines →"}
          </Link>
          <Link
            href={`/teams/${fromFarmSlug ?? teamSlug}/roster/edit`}
            className="text-slate-400 hover:text-blue-400 transition-colors"
          >
            {isCs ? "Čísla a kapitáni →" : "Numbers & captains →"}
          </Link>
        </div>
        <p className="text-xs text-slate-400 mt-2 leading-relaxed">
          {isCs ? (
            <>
              Zvoľte, ktorých <b>20 hráčov nastúpi</b> (NHL) oproti zdravým náhradníkom a manažujte farmu. Jednocestné zmluvy (1-way) nie je možné poslať na farmu priamo — umiestnite ich na <b>Farma/Waivers</b> (hráč s platom nad <b>${(WAIVER_CAP_HIT_LIMIT / 1e6).toFixed(1)}M</b> má príliš vysokú hodnotu a cez waivers neprejde), okrem prípadov s <b>🔓 Výnimkou</b> z predchádzajúceho povolania. Hráči s kontraktom iba pre farmu ($100k) nemôžu byť povolaní do NHL. <b>NHL Náhradníci</b> sa započítavajú do platového stropu. Farmárskeho hráča za <b>$100k</b> možno <b>Prepustiť</b> priamo na trh UFA.
            </>
          ) : (
            <>
              Choose which <b>20 dress</b> (NHL) vs the healthy scratches, and manage the farm. One-way contracts can&apos;t be sent down directly — put them on <b>Farm/Waivers</b> instead (a player over <b>${(WAIVER_CAP_HIT_LIMIT / 1e6).toFixed(1)}M</b> cap hit is too valuable to clear waivers, so that button is disabled for him), unless he still has a <b>🔓 Recall pass</b> from his last call-up — sent up from the AHL within the last 30 days/10 games, he goes back down freely; AHL-only / $100k minor-league deals can&apos;t be called up. <b>NHL Scratched</b> still count against the cap; <b>Farm Scratched</b> dress nowhere. A <b>$100k</b> minor-league player can be <b>Released</b> from Farm Scratched straight to the UFA market.
            </>
          )}
        </p>
      </div>

      {blockers.length > 0 && (
        <div className="mb-2 text-sm text-red-300 bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-2 font-medium">
          {blockers.join(" ")}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="mb-4 text-sm text-amber-300/90 bg-amber-950/30 border border-amber-800/40 rounded-lg px-4 py-2 font-medium">
          {warnings.join(" ")}
        </div>
      )}

      {/* NHL row */}
      <div className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-blue-500" />
        NHL — {teamName}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Col
          title={isCs ? "NHL Zostava" : "NHL Dressed"}
          warn={
            nhlRoster.length > ROSTER_LIMITS.proMax ||
            proSkaters < ROSTER_LIMITS.proMinSkaters ||
            goalies(pro) < ROSTER_LIMITS.proMinGoalies
          }
          sub={
            isCs
              ? `${fdg(pro)} · ${pro.length} nasadených (potrebné 12Ú·6O·2B) · NHL súpiska ${nhlRoster.length}/${ROSTER_LIMITS.proMax}`
              : `${fdg(pro)} · ${pro.length} dressed (need 12F·6D·2G) · NHL roster ${nhlRoster.length}/${ROSTER_LIMITS.proMax}`
          }
          list={pro}
        />
        <Col
          title={isCs ? "NHL Náhradníci (Scratched)" : "NHL Scratched"}
          sub={
            isCs
              ? `${proScratched.length} zdravých náhradníkov · započítava sa do platového stropu`
              : `${proScratched.length} healthy scratch${proScratched.length === 1 ? "" : "es"} · still on the cap`
          }
          list={proScratched}
        />
      </div>

      {/* Farm row */}
      <div className="text-xs uppercase font-bold tracking-wider text-slate-400 mb-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        {isCs ? "Farma" : "Farm"} — {affiliateName}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Col
          title={isCs ? "Farma Zostava" : "Farm Dressed"}
          warn={farm.length > ROSTER_LIMITS.ahlMax}
          sub={
            isCs
              ? `${fdg(farm)} · ${farm.length}/${ROSTER_LIMITS.ahlMax}${
                  farm.length > ROSTER_LIMITS.ahlMax ? " — posaďte nadpočetných" : " (potrebné 12Ú·6O·2B)"
                }`
              : `${fdg(farm)} · ${farm.length}/${ROSTER_LIMITS.ahlMax}${
                  farm.length > ROSTER_LIMITS.ahlMax ? " — scratch the overflow" : " (need 12F·6D·2G)"
                }`
          }
          list={farm}
        />
        <Col
          title={isCs ? "Farma Náhradníci (Scratched)" : "Farm Scratched"}
          sub={
            isCs
              ? `${farmScratched.length} náhradníkov · celá organizácia ${rows.length}/${ROSTER_LIMITS.orgMax}`
              : `${farmScratched.length} scratch${farmScratched.length === 1 ? "" : "es"} · org ${rows.length}/${ROSTER_LIMITS.orgMax}`
          }
          list={farmScratched}
        />
      </div>

      {/* Floating Save Toolbar */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md px-4 py-3 z-30 shadow-2xl">
        <div className="max-w-7xl mx-auto px-2 flex items-center gap-3 flex-wrap">
          <button
            onClick={save}
            disabled={pending || blockers.length > 0}
            className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-bold text-sm disabled:opacity-50 transition-colors shadow-md shadow-blue-600/30"
          >
            {pending ? (isCs ? "Ukladá sa…" : "Saving…") : isCs ? "Uložiť súpisky" : "Save rosters"}
          </button>
          <button
            onClick={autoRoster}
            disabled={pending}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 font-semibold text-sm disabled:opacity-50 border border-slate-700/60 transition-colors"
            title={
              isCs
                ? "Nasadí 20 najlepších (18+2), zvyšok na farmu, nadpočet posadí"
                : "Dress the best available 20 (18+2), the rest to the farm, overflow scratched"
            }
          >
            {isCs ? "Auto súpiska" : "Auto Roster"}
          </button>
          {blockers.length > 0 && (
            <span className="text-rose-400 text-xs font-semibold">
              {isCs ? "Pred uložením vyriešte chyby v limite/strope" : "Fix the cap/limit issue to save"}
            </span>
          )}
          {saved && <span className="text-emerald-400 text-sm font-bold">{isCs ? "✓ Uložené" : "✓ Saved"}</span>}
          {note && <span className="text-amber-300 text-sm">{note}</span>}
          {err && <span className="text-red-400 text-sm">{err}</span>}
        </div>
      </div>
    </div>
  );
}
