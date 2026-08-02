import { prisma } from "@/lib/prisma";
import CreateTradeForm from "@/components/CreateTradeForm";

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
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "24px",
      }}
    >
      <h1>Create Trade</h1>

      <CreateTradeForm teams={teams} />
    </main>
  );
}