import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PopularityEditor from "@/components/PopularityEditor";
import { savePopularity } from "./actions";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AdminFinancePage() {
  const teams = await prisma.team.findMany({
    where: { league: "NHL", isAffiliate: false },
    select: { id: true, name: true, logoUrl: true, popularity: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Team Popularity"
        subtitle="Popularity (0–200) drives attendance and ticket revenue. A winning record raises the effective draw, a losing one lowers it. Saving recomputes bank accounts."
        right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>}
      />
      <PopularityEditor teams={teams} onSave={savePopularity} />
    </div>
  );
}
