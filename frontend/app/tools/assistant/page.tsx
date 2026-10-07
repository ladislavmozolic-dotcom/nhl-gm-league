import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamSession } from "@/lib/auth";
import { intelligenceAccess } from "@/lib/gm-assistant/access";
import { analyzeRoster, type RosterFinding } from "@/lib/gm-assistant/analyzeRoster";
import { slotById, slotPositionFilter } from "@/lib/gm-assistant/leagueSlots";
import { cleanName } from "@/lib/playerName";
import { loadGmBriefing, type BriefingItem } from "@/lib/gm-assistant/gmBriefing";
import { PageHeader, Card } from "@/components/ui";
import { getLang } from "@/lib/lang-server";
import type { Lang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

// UNHL Intelligence — open to any logged-in GM (team session), not admin-only.
// Every function here computes a plain, inspectable number from data already
// live in the DB (Player.overall via TeamLines slots) — no LLM, no black-box
// verdicts. See memory: gm-assistant-intelligence.
export default async function GmAssistantPage() {
  const teamId = await getTeamSession();
  if (teamId == null) notFound();
  const access = await intelligenceAccess();
  if (!access.basic) notFound();
  const admin = access.admin;
  const lang = await getLang();
  const cs = lang === "cs";

  const analysis = await analyzeRoster(teamId);
  const briefing = await loadGmBriefing(teamId, analysis);

  const severityStyle: Record<RosterFinding["severity"], { text: string; bg: string; label: string }> = {
    critical: { text: "text-red-400", bg: "bg-red-950/40 border-red-900/60", label: cs ? "Slabé miesto" : "Weak spot" },
    warning: { text: "text-amber-400", bg: "bg-amber-950/30 border-amber-900/50", label: cs ? "Priemer" : "Average" },
    ok: { text: "text-emerald-400", bg: "bg-emerald-950/20 border-emerald-900/40", label: cs ? "Silná stránka" : "Strength" },
  };

  return (
    <div className="py-2 flex flex-col gap-6">
      <PageHeader title="🧠 UNHL Intelligence" subtitle={cs ? "Explainable roster intelligence — každé zistenie s presnými číslami a hráčmi za ním." : "Explainable roster intelligence — exact numbers and live roster breakdown for every finding."} />

      {briefing && <GmAssistantBriefing briefing={briefing} lang={lang} />}

      <Card title="Analyze My Roster" accent="text-blue-400">
        {!analysis ? (
          <p className="text-sm text-slate-400">{cs ? "Tvoj tím sa nenašiel medzi NHL klubmi." : "Your team was not found among NHL clubs."}</p>
        ) : analysis.findings.length === 0 ? (
          <p className="text-sm text-slate-400">{cs ? "Tvoj roster nemá hráčov na žiadnom sledovanom slote, takže nie je z čoho počítať." : "Your roster has no players in tracked slots to compute metrics from."}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-400">
              {analysis.teamName} — average <span className="text-slate-300 font-semibold">Role Score</span> of the players at that lineup/pair slot
              (a custom weighted combination of STHS parameters by role — top-6 vs. bottom-6, PP vs. PK, ... — each converted to a percentile within C/W/D/G; OV is only indicative and is not used for comparison),
              {cs ? "porovnaný voči rovnakému slotu vo všetkých 32 NHL kluboch." : "compared against the same slot across all 32 NHL clubs."}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysis.findings.map((f) => {
                const s = severityStyle[f.severity];
                const slot = slotById(f.id);
                const posFilter = slot ? slotPositionFilter(slot) : "ALL";
                return (
                  <div key={f.id} className={`border rounded-xl p-3.5 ${s.bg}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-slate-200">{f.label}</span>
                      <span className={`text-xs font-bold uppercase tracking-wide ${s.text}`}>{s.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">
                      {cs ? "Priemer" : "Avg"} <span className="text-slate-200 font-semibold">{f.teamValue}</span> {cs ? "rating" : "rating"} — {f.leagueRank}. {cs ? "miesto z" : "of"} {f.leagueSize} {cs ? "klubov" : "clubs"}
                      {f.auto && <span className="text-amber-400/90"> · {cs ? "auto-zostava (nemáš to uložené)" : "auto-lines (unsaved)"}</span>}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                      {f.players.map((p) => (
                        <Link key={p.id} href={`/players/${p.slug}`} className="text-xs text-slate-300 hover:text-blue-400">
                          {cleanName(p.name)} <span className="text-slate-500">({p.rating ?? "?"})</span>
                        </Link>
                      ))}
                    </div>
                    {access.full && <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <Link href={`/tools/assistant/find-trade-partner?slot=${f.id}`} className="text-xs text-blue-400 hover:text-blue-300 font-semibold">
                        {cs ? "Nájsť trade partnera →" : "Find trade partner →"}
                      </Link>
                      {posFilter !== "ALL" && (
                        <Link href={`/tools/assistant/find-player?pos=${posFilter}&rosterType=UFA`} className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold">
                          {cs ? "Nájsť voľného agenta →" : "Find free agent →"}
                        </Link>
                      )}
                    </div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {analysis && analysis.teamFindings.length > 0 && (
        <Card title={cs ? "Ďalšie zistenia" : "Additional Findings"} accent="text-blue-400">
          <p className="text-sm text-slate-400 mb-3">{cs ? "Cap výhľad, vekový profil, prospect pipeline a rovnováha zostavy — rovnaký princíp: presné číslo, žiadny odhad." : "Cap outlook, age curve, prospect pipeline and roster balance — exact numbers, no guesswork."}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {analysis.teamFindings.map((f) => {
              const s = severityStyle[f.severity];
              return (
                <div key={f.id} className={`border rounded-xl p-3.5 ${s.bg}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-bold text-slate-200">{f.label}</span>
                    <span className={`text-xs font-bold uppercase tracking-wide ${s.text}`}>{s.label}</span>
                  </div>
                  <p className="text-xs text-slate-400">{f.summary}</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {access.full ? <>
        <Card title="Find Player" accent="text-blue-400" href="/tools/assistant/find-player">
          <p className="text-sm text-slate-400">{cs ? "Filtruj hráčov podľa pozície, ratingu, cap hitu, veku a statusu — presné, zoraditeľné výsledky, žiadny model." : "Filter players by position, attributes, cap hit, age and status — inspectable, sortable results."}</p>
        </Card>
        <Card title="Find Trade Partner" accent="text-blue-400" href="/tools/assistant/find-trade-partner">
          <p className="text-sm text-slate-400">{cs ? "Zvoľ slot v zostave a uvidíš, ktoré kluby sú tam silnejšie než ty — presne z tých istých čísel ako vyššie." : "Select a roster slot to see which teams have a surplus there."}</p>
        </Card>
        <Card title="🧪 Scenario Engine" accent="text-blue-400" href="/tools/assistant/scenario">
          <p className="text-sm text-slate-400">{cs ? "„Čo ak?“ — podpíš, obchoduj alebo pusti hráča nanečisto a uvidíš dopad na cap, rebríček aj vek kádra, bez zápisu do ligy." : "“What if?” — mock signings, trades and releases to preview the cap, ranking and age impact without writing to the league."}</p>
        </Card>
        </> : (
          <Card title="Coming soon" accent="text-slate-500" className="md:col-span-2">
            <p className="text-sm text-slate-400">Find Player, Find Trade Partner and the Scenario Engine will be enabled by the commissioner in the next wave.</p>
          </Card>
        )}
        <Card title="🧩 Line Fit Finder" accent="text-blue-400" href="/tools/line-fit">
          <p className="text-sm text-slate-400">Build a line from any players — your own roster, a free agent or a player from another club — and see a projection of chemistry and tactical fit before any deal.</p>
        </Card>
      </div>

      {admin && (
        <Card title="🛡️ Commissioner Intelligence" accent="text-red-400" href="/tools/assistant/commissioner">
          <p className="text-sm text-slate-400">Admin-only: leaguewide cap violations, roster legality and data-consistency checks across all clubs. Read-only, every view is audit-logged.</p>
        </Card>
      )}
    </div>
  );
}

function GmAssistantBriefing({ briefing, lang }: { briefing: NonNullable<Awaited<ReturnType<typeof loadGmBriefing>>>; lang: Lang }) {
  const cs = lang === "cs";
  const style: Record<BriefingItem["priority"], { label: string; text: string; border: string }> = {
    now: { label: cs ? "Teraz" : "Action Now", text: "text-rose-300", border: "border-rose-900/60 bg-rose-950/20" },
    next: { label: cs ? "Ďalší krok" : "Next Step", text: "text-amber-300", border: "border-amber-900/60 bg-amber-950/20" },
    watch: { label: cs ? "Sledovať" : "On Radar", text: "text-sky-300", border: "border-sky-900/60 bg-sky-950/20" },
  };
  return <Card title={cs ? "✨ GM Assistant — denný briefing" : "✨ GM Assistant — Daily Briefing"} accent="text-violet-400">
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-400">
        {cs ? "Smer tímu:" : "Team Direction:"} <span className="font-semibold text-violet-300">{briefing.contentionLabel}</span>
        {briefing.record && <> · {briefing.record.points} b. v {briefing.record.gp} z. ({(briefing.record.pointsPct * 100).toFixed(1)} %)</>}
        {briefing.form && briefing.form.streak !== 0 && <> · {cs ? "aktuálna séria:" : "streak:"} <span className={briefing.form.streak > 0 ? "text-emerald-300" : "text-rose-300"}>{cs ? (briefing.form.streak > 0 ? `${briefing.form.streak} výhry` : `${Math.abs(briefing.form.streak)} prehry`) : (briefing.form.streak > 0 ? `${briefing.form.streak}W streak` : `${Math.abs(briefing.form.streak)}L streak`)}</span></>}
      </p>
      <p className="text-xs text-slate-500">{cs ? "Prioritizované odporúčania z postavenia tímu, formy, capu a porovnania role score. Sú poradenské — žiadny krok sa nevykoná automaticky." : "Prioritized recommendations based on team standings, form, cap room and role scores. Advisory only."}</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {briefing.items.map((item) => {
          const s = style[item.priority];
          return <div key={item.id} className={`border rounded-xl p-3.5 ${s.border}`}>
            <div className="flex items-center justify-between gap-3 mb-1"><span className="text-sm font-semibold text-slate-100">{item.title}</span><span className={`text-[10px] font-bold uppercase tracking-wider ${s.text}`}>{s.label}</span></div>
            <p className="text-xs leading-relaxed text-slate-400">{item.detail}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2.5">{item.actions.map((action) => <Link key={action.href} href={action.href} className={action.tone === "emerald" ? "text-xs font-semibold text-emerald-400 hover:text-emerald-300" : action.tone === "amber" ? "text-xs font-semibold text-amber-400 hover:text-amber-300" : "text-xs font-semibold text-blue-400 hover:text-blue-300"}>{action.label} →</Link>)}</div>
          </div>;
        })}
      </div>
      <GmMarketRadar briefing={briefing} lang={lang} />
    </div>
  </Card>;
}

function GmMarketRadar({ briefing, lang }: { briefing: NonNullable<Awaited<ReturnType<typeof loadGmBriefing>>>; lang: Lang }) {
  const cs = lang === "cs";
  const { radar } = briefing;
  const money = (value: number | null) => value == null ? "—" : `$${(value / 1_000_000).toFixed(1)}M`;
  const playerLink = (p: { id: number; name: string; slug: string | null }) => p.slug ? `/players/${p.slug}` : `/players/${p.id}`;
  return <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 pt-1">
    <div className="rounded-xl border border-violet-900/60 bg-violet-950/15 overflow-hidden">
      <div className="flex justify-between items-center gap-3 px-3.5 py-2.5 border-b border-violet-900/50"><div><span className="font-semibold text-sm text-violet-200">🧱 Trade Block radar</span><p className="text-[11px] text-slate-500">Match for: {radar.positions.length ? radar.positions.join(", ") : "set your team needs or wait for the roster analysis"}</p></div><Link href="/trade-block" className="text-xs text-blue-400 hover:text-blue-300">{cs ? "Celý Trade Block →" : "View Trade Block →"}</Link></div>
      {radar.tradeBlock.length ? <div className="divide-y divide-violet-950/80">{radar.tradeBlock.map((p) => <div key={p.id} className="px-3.5 py-2.5 flex items-center gap-2.5"><div className="min-w-0 flex-1"><Link href={playerLink(p)} className="text-sm font-semibold text-slate-200 hover:text-blue-400">{p.name}</Link><p className="text-[11px] text-slate-500">{p.teamCode ?? p.teamName} · {p.position}{p.farm ? " · AHL" : ""}{p.note ? ` · ${p.note}` : ""}</p></div><div className="text-right text-xs text-slate-400"><span className="font-semibold text-slate-200">OVR {p.overall ?? "—"}</span><br />{p.age ?? "—"} yo · {money(p.capHit)}</div></div>)}</div> : <p className="px-3.5 py-4 text-xs text-slate-500">{cs ? "Momentálne nie je na Trade Blocku hráč, ktorý by sedel na sledovanú pozíciu. Radar sa obnoví pri ďalšom otvorení stránky." : "No players on the Trade Block matching watched needs right now."}</p>}
    </div>
    <div className="rounded-xl border border-amber-900/60 bg-amber-950/15 overflow-hidden">
      <div className="flex justify-between items-center gap-3 px-3.5 py-2.5 border-b border-amber-900/50"><div><span className="font-semibold text-sm text-amber-200">📋 Waiver watch</span><p className="text-[11px] text-slate-500">{radar.waiversEnabled ? (cs ? `Tvoja priorita nároku: ${radar.waiverPriority ?? "—"}. z 32` : `Your claim priority: #${radar.waiverPriority ?? "—"} of 32`) : (cs ? "Waivery sú v nastaveniach ligy vypnuté." : "Waivers are disabled in league settings.")}</p></div><Link href="/waivers" className="text-xs text-blue-400 hover:text-blue-300">{cs ? "Waiver wire →" : "Waiver wire →"}</Link></div>
      {!radar.waiversEnabled ? <p className="px-3.5 py-4 text-xs text-slate-500">Once waivers are enabled, the radar will pick active players that fit your team's needs.</p> : radar.waivers.length ? <div className="divide-y divide-amber-950/80">{radar.waivers.map((p) => <div key={p.id} className="px-3.5 py-2.5 flex items-center gap-2.5"><div className="min-w-0 flex-1"><Link href={playerLink(p)} className="text-sm font-semibold text-slate-200 hover:text-blue-400">{p.name}</Link><p className="text-[11px] text-slate-500">from {p.teamCode ?? p.teamName} · {p.position} · {p.claimCount ? `${p.claimCount} claims` : "no claims"}</p></div><div className="text-right text-xs text-slate-400"><span className="font-semibold text-slate-200">OVR {p.overall ?? "—"}</span><br />{p.age ?? "—"} yo · {money(p.capHit)}</div></div>)}</div> : <p className="px-3.5 py-4 text-xs text-slate-500">{cs ? "Na waiveroch teraz nie je žiadny hráč, ktorý by sedel na sledovanú pozíciu. Sleduje sa živý stav waiver wire." : "No players on waivers matching your team needs right now."}</p>}
    </div>
  </div>;
}
