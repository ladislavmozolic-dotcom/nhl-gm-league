import { prisma } from "@/lib/prisma";
import CreateTradeForm from "@/components/CreateTradeForm";
import { PageHeader, Card } from "@/components/ui";

export default async function NewTradePage() {
  const teams = await prisma.team.findMany({
    where: {
      parentTeamId: null,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Create Trade" subtitle="Build a new trade proposal" />
      <Card>
        <CreateTradeForm teams={teams} />
      </Card>
    </div>
  );
}