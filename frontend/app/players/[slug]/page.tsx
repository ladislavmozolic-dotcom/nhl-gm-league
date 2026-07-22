import Link from "next/link";
import Image from "next/image";
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
      <Link href={`/teams/${player.team.slug}`}>
        ← Back to Team
      </Link>

      <div
        style={{
          display: "flex",
          gap: "24px",
          alignItems: "center",
          marginTop: "20px",
          marginBottom: "30px",
        }}
      >
        {player.photoUrl && (
          <Image
            src={player.photoUrl}
            alt={`Photo of ${player.name}`}
            width={200}
            height={200}
          />
        )}

        <div>
          <h1 style={{ margin: 0 }}>{player.name}</h1>

          <p>
            <strong>Team:</strong>{" "}
            <Link href={`/teams/${player.team.slug}`}>
              {player.team.name}
            </Link>
          </p>

          <p>
            <strong>Position:</strong>{" "}
            {player.positions || player.position}
          </p>

          <p>
            <strong>Age:</strong> {player.age ?? "-"}
          </p>

          <p>
            <div
  style={{
    marginTop: "12px",
    display: "inline-block",
    padding: "10px 20px",
    borderRadius: "10px",
    fontWeight: "bold",
    fontSize: "24px",
    color:
      (player.overall ?? 0) >= 80
        ? "#22c55e"
        : (player.overall ?? 0) >= 70
        ? "#eab308"
        : "#ef4444",
    border: "2px solid currentColor",
  }}
>
  OVR {player.overall ?? "-"}
</div>
          </p>
        </div>
      </div>

      <p>
        <strong>Number:</strong> #{player.number ?? "-"}
      </p>

      <p>
        <strong>Position:</strong>{" "}
        {player.positions || player.position}
      </p>

      <p>
        <strong>Team:</strong>{" "}
        <Link href={`/teams/${player.team.slug}`}>
          {player.team.name}
        </Link>
      </p>

      <p>
        <strong>Team Code:</strong> {player.team.code}
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

     <h2>Ratings</h2>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "12px",
  }}
>
  {[
    ["CK", player.ck],
    ["FG", player.fg],
    ["DI", player.di],
    ["SK", player.sk],
    ["ST", player.st],
    ["EN", player.en],
    ["DU", player.du],
    ["PH", player.ph],
    ["FO", player.fo],
    ["PA", player.pa],
    ["SC", player.sc],
    ["DF", player.df],
    ["PS", player.ps],
    ["EX", player.ex],
    ["LD", player.ld],
    ["MO", player.mo],
  ].map(([label, value]) => (
    <div
      key={label}
      style={{
        border: "1px solid #334155",
        borderRadius: "8px",
        padding: "12px",
        textAlign: "center",
        backgroundColor: "#0f172a",
      }}
    >
      <div
  style={{
    fontSize:
      ["CK", "PA", "SC", "DF"].includes(String(label))
        ? "14px"
        : "12px",
    fontWeight:
      ["CK", "PA", "SC", "DF"].includes(String(label))
        ? "bold"
        : "normal",
    color:
      ["CK", "PA", "SC", "DF"].includes(String(label))
        ? "#ffffff"
        : "#94a3b8",
  }}
>
  {label}
</div>

      <div
        style={{
          fontWeight: "bold",
          fontSize:
            ["CK", "PA", "SC", "DF"].includes(String(label))
              ? "28px"
              : "22px",
          color:
            ["CK", "PA", "SC", "DF"].includes(String(label))
              ? (Number(value) || 0) >= 65
                ? "#22c55e"
                : (Number(value) || 0) >= 60
                ? "#eab308"
                : "#ef4444"
              : "#ffffff",
        }}
      >
        {value ?? "-"}
      </div>
    </div>
  ))}
</div>
    </main>
  );
}