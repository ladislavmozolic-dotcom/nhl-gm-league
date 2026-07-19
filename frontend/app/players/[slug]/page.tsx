import Link from "next/link";
import { PrismaClient } from "@prisma/client";

export default async function PlayerDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const prisma = new PrismaClient();

  const { slug } = await params;

  const player = await prisma.player.findUnique({
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

      <p>
        <strong>PHOTO URL:</strong> {player.photoUrl ?? "NULL"}
      </p>

      {player.photoUrl && (
        <div style={{ marginBottom: "20px" }}>
          <img
            src={player.photoUrl}
            alt={player.name}
            width={168}
            height={168}
          />
        </div>
      )}

      <p>
        <strong>Number:</strong> #{player.number ?? "-"}
      </p>

      <p>
        <strong>Position:</strong> {player.position}
      </p>

      <p>
        <strong>Team:</strong>{" "}
        <Link href={`/teams/${player.team.slug}`}>
          {player.team.name}
        </Link>
      </p>

      <p>
        <strong>NHL ID:</strong> {player.nhlId ?? "-"}
      </p>

      <p>
        <strong>Nationality:</strong>{" "}
        {(player as any).nationality ?? "-"}
      </p>

      <p>
        <strong>Birth Date:</strong>{" "}
        {player.birthDate ?? "-"}
      </p>

      <p>
        <strong>Birth Place:</strong>{" "}
        {player.birthPlace ?? "-"}
      </p>

      <p>
        <strong>Shoots:</strong>{" "}
        {player.shoots ?? "-"}
      </p>

      <p>
        <strong>Height:</strong>{" "}
        {player.height ?? "-"}
      </p>

      <p>
        <strong>Weight:</strong>{" "}
        {player.weight ?? "-"} lbs
      </p>

      <hr />

      <h2>Contract</h2>

      <p>
        <strong>Cap Hit:</strong>{" "}
        {(player as any).capHit
          ? `$${(player as any).capHit.toFixed(2)}M`
          : "-"}
      </p>

      <p>
        <strong>Years Left:</strong>{" "}
        {(player as any).contractYears ?? "-"}
      </p>

      <p>
        <strong>Expiry:</strong>{" "}
        {(player as any).contractExpiry ?? "-"}
      </p>
    </main>
  );
}