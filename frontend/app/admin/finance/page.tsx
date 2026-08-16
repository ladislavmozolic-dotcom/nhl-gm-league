import Link from "next/link";
import { prisma } from "@/lib/prisma";
import PopularityEditor from "@/components/PopularityEditor";
import CoachImportButton from "@/components/CoachImportButton";
import { savePopularity } from "./actions";
import { PageHeader, Card } from "@/components/ui";

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
      <Card>
        <div className="text-sm font-semibold mb-1">Coaching salaries</div>
        <p className="text-xs text-slate-500 mb-3">Pull each club&apos;s head-coach salary (NHL + AHL) from profinhl.cz/Coaches.php and link the coach. Feeds the Detailed Finance coaching-expense line.</p>
        <CoachImportButton />
      </Card>
      <PopularityEditor teams={teams} onSave={savePopularity} />
    </div>
  );
}
