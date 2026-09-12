import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { analyzeRoster, type RosterFinding } from "@/lib/gm-assistant/analyzeRoster";
import { slotById, slotPositionFilter } from "@/lib/gm-assistant/leagueSlots";
import { cleanName } from "@/lib/playerName";
import { PageHeader, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

// GM Assistant — not linked anywhere and 404s for anyone but the commissioner
// login. Every function here computes a plain, inspectable number from data
// already live in the DB (Player.overall via TeamLines slots) — no LLM, no
// black-box verdicts. See memory: gm-assistant-intelligence.
export default async function GmAssistantPage() {
  if (!(await isAdmin())) notFound();
  const teamId = await getTeamSession();
  if (teamId == null) notFound();

  const analysis = await analyzeRoster(teamId);

  const severityStyle: Record<RosterFinding["severity"], { text: string; bg: string; label: string }> = {
    critical: { text: "text-red-400", bg: "bg-red-950/40 border-red-900/60", label: "Slabé miesto" },
    warning: { text: "text-amber-400", bg: "bg-amber-950/30 border-amber-900/50", label: "Priemer" },
    ok: { text: "text-emerald-400", bg: "bg-emerald-950/20 border-emerald-900/40", label: "Silná stránka" },
  };

  return (
    <div className="py-2 flex flex-col gap-6">
      <PageHeader title="🧠 GM Assistant" subtitle="Explainable roster intelligence — každé zistenie s presnými číslami a hráčmi za ním." />

      <Card title="Analyze My Roster" accent="text-blue-400">
        {!analysis ? (
          <p className="text-sm text-slate-400">Tvoj tím sa nenašiel medzi NHL klubmi.</p>
        ) : analysis.findings.length === 0 ? (
          <p className="text-sm text-slate-400">Tvoj roster nemá hráčov na žiadnom sledovanom slote, takže nie je z čoho počítať.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-400">
              {analysis.teamName} — priemerný <span className="text-slate-300 font-semibold">rating</span> hráčov na danom slote formácie/páru
              (CK/PA/SC/DF pre korčuliarov, overall pre brankárov — OV je len orientačné, nepoužíva sa na porovnanie),
              porovnaný voči rovnakému slotu vo všetkých 32 NHL kluboch.
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
                      Priemer <span className="text-slate-200 font-semibold">{f.teamValue}</span> rating — {f.leagueRank}. miesto z {f.leagueSize} klubov
                      {f.auto && <span className="text-amber-400/90"> · auto-zostava (nemáš to uložené)</span>}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
                      {f.players.map((p) => (
                        <Link key={p.id} href={`/players/${p.slug}`} className="text-xs text-slate-300 hover:text-blue-400">
                          {cleanName(p.name)} <span className="text-slate-500">({p.rating ?? "?"})</span>
                        </Link>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <Link href={`/tools/assistant/find-trade-partner?slot=${f.id}`} className="text-xs text-blue-400 hover:text-blue-300 font-semibold">
                        Nájsť trade partnera →
                      </Link>
                      {posFilter !== "ALL" && (
                        <Link href={`/tools/assistant/find-player?pos=${posFilter}&rosterType=UFA`} className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold">
                          Nájsť voľného agenta →
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title="Find Player" accent="text-blue-400" href="/tools/assistant/find-player">
          <p className="text-sm text-slate-400">Filtruj hráčov podľa pozície, ratingu, cap hitu, veku a statusu — presné, zoraditeľné výsledky, žiadny model.</p>
        </Card>
        <Card title="Find Trade Partner" accent="text-blue-400" href="/tools/assistant/find-trade-partner">
          <p className="text-sm text-slate-400">Zvoľ slot v zostave a uvidíš, ktoré kluby sú tam silnejšie než ty — presne z tých istých čísel ako vyššie.</p>
        </Card>
      </div>
    </div>
  );
}
