import { PrismaClient } from "@prisma/client";
import { updateContract } from "../actions";

export default async function ContractEditPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const prisma = new PrismaClient();

  const { slug } = await params;

  const player = await prisma.player.findFirst({
    where: {
      slug,
    },
    include: {
      team: true,
    },
  });

  if (!player) {
    return <h1>Player not found</h1>;
  }

  return (
    <main>
      <h1>{player.name}</h1>

      <p>Team: {player.team.name}</p>

      <hr />

      <form action={updateContract}>
        <input
          type="hidden"
          name="slug"
          value={player.slug}
        />

        <p>
          Cap Hit
          <br />
          <input
            type="number"
            step="0.01"
            name="capHit"
            defaultValue={player.capHit ?? ""}
          />
        </p>

        <p>
          Years Left
          <br />
          <input
            type="number"
            min="1"
            max="4"
            name="contractYears"
            defaultValue={player.contractYears ?? ""}
          />
        </p>

        <p>
          Expiry
          <br />
          <input
            type="number"
            name="contractExpiry"
            defaultValue={player.contractExpiry ?? ""}
          />
        </p>

        <button type="submit">
          Save Contract
        </button>
      </form>

      <hr />

      <h2>Current Contract</h2>

      <p>
        Cap Hit:{" "}
        {player.capHit
          ? `$${player.capHit.toFixed(2)}M`
          : "-"}
      </p>

      <p>
        Years Left: {player.contractYears ?? "-"}
      </p>

      <p>
        Expiry: {player.contractExpiry ?? "-"}
      </p>
    </main>
  );
}