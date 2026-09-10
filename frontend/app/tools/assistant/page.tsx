import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamSession, isAdmin } from "@/lib/auth";
import { analyzeRoster, type RosterFinding } from "@/lib/gm-assistant/analyzeRoster";
import { cleanName } from "@/lib/playerName";
import { PageHeader, Card, SectionTitle } from "@/components/ui";

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
          <p className="text-sm text-slate-400">Zatiaľ nemáš nastavené formácie/páry (Team Lines), takže nie je z čoho počítať.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-slate-400">
              {analysis.teamName} — priemerný <span className="text-slate-300 font-semibold">overall</span> hráčov na danom slote formácie/páru,
              porovnaný voči rovnakému slotu vo všetkých {analysis.findings[0]?.leagueSize ?? 32} NHL kluboch.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {analysis.findings.map((f) => {
                const s = severityStyle[f.severity];
                return (
                  <div key={f.id} className={`border rounded-xl p-3.5 ${s.bg}`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-bold text-slate-200">{f.label}</span>
                      <span className={`text-xs font-bold uppercase tracking-wide ${s.text}`}>{s.label}</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-2">
                      Priemer <span className="text-slate-200 font-semibold">{f.teamValue}</span> overall — {f.leagueRank}. miesto z {f.leagueSize} klubov
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {f.players.map((p) => (
                        <Link key={p.id} href={`/players/${p.slug}`} className="text-xs text-slate-300 hover:text-blue-400">
                          {cleanName(p.name)} <span className="text-slate-500">({p.overall ?? "?"})</span>
                        </Link>
                      ))}
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
        <Card title="Find Trade Partner" accent="text-slate-500">
          <SectionTitle accent="text-slate-600">Čoskoro</SectionTitle>
          <p className="text-sm text-slate-500">Kluby s prebytkom presne tam, kde tebe chýba — na základe zistení vyššie.</p>
        </Card>
      </div>
    </div>
  );
}
