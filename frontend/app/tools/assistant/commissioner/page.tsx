import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { commissionerName, recordCommishIntelView, recentCommishIntelAudits } from "@/lib/audit-server";
import { loadCommissionerIntel, summarizeForAudit, type CommissionerFinding } from "@/lib/gm-assistant/commissionerIntel";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { getLang } from "@/lib/lang-server";

export const dynamic = "force-dynamic";

// UNHL Intelligence — Commissioner Intelligence (roadmap Phase 7). Admin-only,
// unlike every other UNHL Intelligence tool: leaguewide integrity/consistency
// data about every club isn't something a regular GM should see about clubs
// that aren't theirs. Read-only/advisory — never auto-fixes anything — and
// every view is logged (CommishIntelAudit), per the design doc's requirement
// that every commissioner query be audited. See memory: gm-assistant-intelligence.

export default async function CommissionerIntelligencePage() {
  if (!(await isAdmin())) redirect("/login");

  const lang = await getLang();
  const cs = lang === "cs";

  const severityStyle: Record<CommissionerFinding["severity"], { text: string; bg: string; label: string }> = {
    critical: { text: "text-red-400", bg: "bg-red-950/40 border-red-900/60", label: cs ? "Kritické" : "Critical" },
    warning: { text: "text-amber-400", bg: "bg-amber-950/30 border-amber-900/50", label: cs ? "Pozor" : "Warning" },
    ok: { text: "text-emerald-400", bg: "bg-emerald-950/20 border-emerald-900/40", label: cs ? "V poriadku" : "OK" },
  };

  const intel = await loadCommissionerIntel();
  const byName = await commissionerName();
  await recordCommishIntelView(byName, summarizeForAudit(intel));
  const recent = await recentCommishIntelAudits(15);

  const flaggedCount = intel.findings.filter((f) => f.rows.length > 0).length;

  return (
    <div className="py-2 flex flex-col gap-6">
      <PageHeader
        title="🛡️ Commissioner Intelligence"
        subtitle={cs ? "UNHL Intelligence — admin-only leaguewide integrity a data-consistency kontroly. Read-only, nič sa neopravuje automaticky." : "UNHL Intelligence — admin-only integrity & data-consistency audits. Read-only."}
        right={<BackPill href="/tools/assistant">UNHL Intelligence</BackPill>}
      />

      <Card accent="text-blue-400">
        <p className="text-sm text-slate-400">
          {flaggedCount === 0
            ? (cs ? "Všetkých 6 kontrol je čistých — žiadny nález." : "All 6 checks are clean — no integrity issues.")
            : (cs ? `${flaggedCount} z 6 kontrol má aspoň jeden nález. Každé zobrazenie tejto stránky sa zaznamenáva do audit logu nižšie.` : `${flaggedCount} of 6 checks flagged at least one item. Every view of this page is audit-logged.`)}
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {intel.findings.map((f) => {
          const s = severityStyle[f.severity];
          return (
            <Card key={f.id} title={f.label} accent="text-blue-400" bodyClassName="p-0">
              <div className={`border-b px-4 py-2.5 ${s.bg}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold uppercase tracking-wide ${s.text}`}>{s.label}</span>
                  <span className="text-xs text-slate-400">{f.rows.length} {cs ? "nález(ov)" : "flag(s)"}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{f.summary}</p>
              </div>
              {f.rows.length > 0 && (
                <div className="p-3 flex flex-col gap-1.5 max-h-72 overflow-y-auto">
                  {f.rows.map((r, i) => (
                    <div key={i} className="text-xs text-slate-300 border border-slate-800 bg-slate-900/40 rounded-lg px-2.5 py-1.5 flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        {r.playerId != null && (
                          <Link href={`/players/${r.playerId}`} className="font-semibold text-slate-200 hover:text-blue-400">{r.playerName}</Link>
                        )}
                        {r.playerId == null && r.teamName && <span className="font-semibold text-slate-200">{r.teamName}</span>}
                        {r.playerId != null && r.teamName && <span className="text-slate-500">· {r.teamName}</span>}
                      </div>
                      <span className="text-slate-400">{r.detail}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card title="Audit log — latest queries" accent="text-slate-400">
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">No entries yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {recent.map((r) => (
              <div key={r.id} className="text-xs text-slate-400 flex items-center gap-3 border-b border-slate-900 pb-1.5">
                <span className="text-slate-500 shrink-0">{new Date(r.createdAt).toLocaleString("en-GB")}</span>
                <span className="font-semibold text-slate-300 shrink-0">{r.byName}</span>
                <span className="truncate">{r.summary}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
