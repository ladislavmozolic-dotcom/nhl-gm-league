import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, BackPill } from "@/components/ui";
import ExpansionTeamForm from "@/components/ExpansionTeamForm";
import { createExpansionTeamAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function NewExpansionTeamPage() {
  if (!(await isAdmin())) redirect("/login");

  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { conference: true, division: true },
  });
  const counts = new Map<string, number>();
  for (const t of teams) {
    const key = `${t.conference || "—"} / ${t.division || "—"}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const balance = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="mx-auto max-w-3xl px-4 py-2 space-y-6">
      <PageHeader title="Add Expansion Team" subtitle="Creates the club, its AHL affiliate and a placeholder coach — ready for the protection-list window." right={<BackPill href="/admin/expansion">Expansion</BackPill>} />
      <Card title="Current conference / division balance">
        <div className="grid sm:grid-cols-2 gap-2 text-sm">
          {balance.map(([key, n]) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-slate-800 px-3 py-1.5">
              <span className="text-slate-300">{key}</span>
              <span className="text-slate-500 tabular-nums">{n} teams</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 mt-3">Place the new club to keep divisions as even as possible — nothing here auto-realigns existing teams.</p>
      </Card>
      <Card title="Team details">
        <ExpansionTeamForm action={createExpansionTeamAction} />
      </Card>
    </div>
  );
}
