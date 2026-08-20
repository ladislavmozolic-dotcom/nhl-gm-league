import Link from "next/link";
import PlayerLink from "@/components/PlayerLink";
import { PageHeader, Card } from "@/components/ui";
import { milestoneWatch, type MilestoneItem } from "@/lib/milestones";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<MilestoneItem["kind"], string> = { points: "career points", goals: "career goals", assists: "career assists", gp: "career games" };
const KIND_ICON: Record<MilestoneItem["kind"], string> = { points: "🌟", goals: "🏒", assists: "🎯", gp: "📅" };

function TeamTag({ code, logo }: { code: string | null; logo: string | null }) {
  if (!code) return null;
  return <span className="inline-flex items-center gap-1 text-slate-500 text-xs">{logo && <img src={logo} alt="" className="w-4 h-4 object-contain" />}{code}</span>;
}

export default async function MilestonesPage() {
  const { career, records } = await milestoneWatch();
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Milestone Watch" subtitle="Active players closing in on career milestones and club records." />

      <Card title="🎯 Approaching a career milestone" bodyClassName="p-0">
        <div className="divide-y divide-slate-800/60">
          {career.length === 0 && <div className="px-4 py-4 text-slate-600 text-sm">Nobody is within range of a milestone right now — they build as careers grow.</div>}
          {career.map((m, i) => (
            <div key={`${m.playerId}-${m.kind}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-800/30">
              <span className="w-5 text-right text-slate-500 tabular-nums">{i + 1}</span>
              <span>{KIND_ICON[m.kind]}</span>
              <span className="flex-1 min-w-0 truncate">
                <PlayerLink id={m.playerId} name={m.name} slug={m.slug ?? undefined} clean={false} /> <TeamTag code={m.teamCode} logo={m.teamLogo} />
              </span>
              <span className="text-slate-400 text-xs tabular-nums hidden sm:inline">{m.total} → {m.next}</span>
              <span className="font-bold text-amber-400 tabular-nums whitespace-nowrap">{m.toGo} to {m.next}</span>
              <span className="text-slate-500 text-xs whitespace-nowrap hidden md:inline">{KIND_LABEL[m.kind]}</span>
            </div>
          ))}
        </div>
      </Card>

      {records.length > 0 && (
        <Card title="🏛️ Chasing a club single-season record" bodyClassName="p-0">
          <div className="divide-y divide-slate-800/60">
            {records.map((r) => (
              <div key={`${r.playerId}-${r.metric}`} className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-800/30">
                <span>{r.metric === "goals" ? "🏒" : "🌟"}</span>
                <span className="flex-1 min-w-0 truncate">
                  <PlayerLink id={r.playerId} name={r.name} slug={r.slug ?? undefined} clean={false} /> <TeamTag code={r.teamCode} logo={r.teamLogo} />
                </span>
                <span className="font-bold text-fuchsia-400 tabular-nums whitespace-nowrap">{r.toGo} to record</span>
                <span className="text-slate-500 text-xs whitespace-nowrap hidden sm:inline">{r.metric} · record {r.record}{r.holder ? ` (${r.holder})` : ""}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <p className="text-xs text-slate-600"><Link href="/history" className="hover:text-blue-400">League history & records →</Link></p>
    </div>
  );
}
