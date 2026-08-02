import Link from "next/link";
import { prisma } from "@/lib/prisma";
import MovePlayerButton from "@/components/MovePlayerButton";
import TradeBlockButton from "@/components/TradeBlockButton";
import WaiveButton from "@/components/WaiveButton";

// Some imported components are typed as React components without explicit props
// in this project setup. Create any-typed aliases so TSX prop usage below
// (e.g. playerId) doesn't error during type checking.
const MovePlayerButtonAny: any = MovePlayerButton;
const TradeBlockButtonAny: any = TradeBlockButton;
const WaiveButtonAny: any = WaiveButton;

export default async function TeamPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const capLimit = 85.9;

  const teams = await prisma.team.findMany({
  where: {
    parentTeamId: null,
  },
  orderBy: {
    name: "asc",
  },
  include: {
    affiliateTeams: true,
  },
});

  const team = teams.find((t: any) => t.slug === slug);

  if (!team) {
    return <h1>Team not found</h1>;
  }

  const teamPlayers = await prisma.player.findMany({
    where: {
      teamId: team.id,
    },
    orderBy: {
      overall: "desc",
    } as any,
  });
  console.log(
  "ROSTER TYPES:",
  [...new Set(teamPlayers.map((p: any) => p.rosterType))]
);const rempePlayers = teamPlayers.filter(
  (p: any) => p.name.includes("Rempe")
);

console.log("REMPE:", rempePlayers);


  // 'prospect' model may not exist on the Prisma client in some schemas.
  // Fallback to an empty array so the page still renders.
  const prospects = await (prisma as any).prospect.findMany({
  where: {
    teamId: team.id,
  },
});

const draftPicks = await (prisma as any).draftPick.findMany({
  where: {
    teamId: team.id,
  },
  orderBy: [
    {
      year: "asc",
    },
    {
      round: "asc",
    },
  ],
});
console.log("DRAFT PICKS:", draftPicks.length);

console.log(
  prospects.map((p: any) => ({
    id: p.id,
    name: p.name,
  }))
);


  const nhlPlayers = teamPlayers.filter(
    (player) => (player as any).rosterType === "NHL"
  );
  console.log(
  "NHL COUNT",
  nhlPlayers.length
);

console.log(
  "NHL ROSTERS",
  [...new Set(nhlPlayers.map((p: any) => p.rosterType))]
);
  const nhlForwards = nhlPlayers.filter(
  (player: any) =>
    player.position?.includes("C") ||
    player.position?.includes("LW") ||
    player.position?.includes("RW")
);

const nhlDefense = nhlPlayers.filter(
  (player: any) => player.position === "D"
);

const nhlGoalies = nhlPlayers.filter(
  (player: any) => player.position === "G"
);

const capHit = nhlPlayers.reduce(
  (sum: number, player: any) => {
    if (!player.contractText) return sum;

    const salary = parseFloat(
      player.contractText
        .split("$")[0]
        .replace(/,/g, "")
    );

    return sum + (salary || 0) / 1000000;
  },
  0
);
console.log(
  nhlPlayers.slice(0, 5).map((p: any) => ({
    name: p.name,
    capHit: p.capHit,
    contractText: p.contractText,
  }))
);

const capSpace = capLimit - capHit;

nhlForwards.sort(
  (a: any, b: any) => (b.overall ?? 0) - (a.overall ?? 0)
);

nhlDefense.sort(
  (a: any, b: any) => (b.overall ?? 0) - (a.overall ?? 0)
);

nhlGoalies.sort(
  (a: any, b: any) => (b.overall ?? 0) - (a.overall ?? 0)
);

  const ahlPlayers = teamPlayers.filter(
    (player) => (player as any).rosterType === "AHL"
  );
  console.log(
  "AHL COUNT",
  ahlPlayers.length
);

console.log(
  "AHL ROSTERS",
  [...new Set(ahlPlayers.map((p: any) => p.rosterType))]
);

  const ahlForwards = ahlPlayers.filter(
  (player: any) =>
    player.position?.includes("C") ||
    player.position?.includes("LW") ||
    player.position?.includes("RW")
);

const ahlDefense = ahlPlayers.filter(
  (player: any) => player.position === "D"
);

const ahlGoalies = ahlPlayers.filter(
  (player: any) => player.position === "G"
);

ahlForwards.sort(
  (a: any, b: any) => (b.overall ?? 0) - (a.overall ?? 0)
);

ahlDefense.sort(
  (a: any, b: any) => (b.overall ?? 0) - (a.overall ?? 0)
);

ahlGoalies.sort(
  (a: any, b: any) => (b.overall ?? 0) - (a.overall ?? 0)
);

  return (
    <main>
      <Link href="/teams">← Back to Teams</Link>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "24px",
          marginTop: "20px",
          marginBottom: "30px",
        }}
      >
        {team.logoUrl && (
          <img src={team.logoUrl} alt={team.name} style={{ height: "120px" }} />
        )}

        <div>
          <h1
            style={{
              margin: 0,
              marginBottom: "16px",
            }}
          >
            {team.name}
          </h1>

          <div
            style={{
              border: "1px solid #334155",
              borderRadius: "12px",
              padding: "16px",
              minWidth: "420px",
            }}
          >
            <p>
              <strong>GM:</strong> {team.gm || "-"}
            </p>

            <p>
              <strong>Coach:</strong> {(team as any).coach || "-"}
            </p>

            <p>
              <strong>Conference:</strong> {(team as any).conference || "-"}
            </p>

            <p>
              <strong>Division:</strong> {(team as any).division || "-"}
            </p>

            <p>
              <strong>Arena:</strong> {(team as any).arena || "-"}
            </p>

            <p>
  <strong>Capacity:</strong>{" "}
  {(team as any).capacity?.toLocaleString() || "-"}
</p>

<p>
  <strong>Cap Hit:</strong> ${capHit.toFixed(2)}M
</p>

<p>
  <strong>Cap Space:</strong>{" "}
  <span
    style={{
      color:
        capSpace >= 5
          ? "#22c55e"
          : capSpace >= 0
          ? "#eab308"
          : "#ef4444",
      fontWeight: "bold",
    }}
  >
    ${capSpace.toFixed(2)}M
  </span>
</p>

            <p>
              <strong>League:</strong> {team.league}
            </p>

            {team.parentTeamId && (
              <p>
                <strong>Parent Team:</strong>{" "}
                <Link href={`/teams/${team.parentTeamId}`}>
                  View Team
                </Link>
              </p>
            )}

            {team.affiliateTeams?.length > 0 && (
              <p>
                <strong>Farm Team:</strong>{" "}
                <Link href={`/teams/${team.affiliateTeams[0].slug}`}>
                  {team.affiliateTeams[0].name}
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>

{team.league === "NHL" && (
  <>
  <table
    style={{
    width: "100%",
     borderCollapse: "collapse",
    marginBottom: "40px",
       }}
      >
    <thead>
     <tr>
     <th style={{ width: "35%", textAlign: "left", padding: "8px" }}>
          Name
     </th>
      <th style={{ width: "15%", textAlign: "left", padding: "8px" }}>
          Pos
      </th>
      <th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
          Age
 </th>
 <th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
     OVR
 </th>
 <th style={{ width: "20%", textAlign: "left", padding: "8px" }}>
     Contract
 </th>
 <th style={{ textAlign: "left", padding: "8px" }}>
     Action
 </th>
 </tr>
 </thead>
 <tbody>
   {nhlForwards.map((player: any) => (
 <tr
   key={player.id}
   style={{
   borderTop: "1px solid #334155",
    }}
    >
 <td style={{ padding: "8px" }}>
  <Link href={`/players/${player.slug}`}>
       {player.name}
  </Link>
  </td>
   <td style={{ padding: "8px" }}>
       {player.positions || player.position}
   </td>
   <td style={{ padding: "8px" }}>
       {player.age ?? "-"}
   </td>
   <td
      style={{
       padding: "8px",
       color:
       (player.overall ?? 0) >= 80
            ? "#22c55e"
            : (player.overall ?? 0) >= 70
            ? "#eab308"
            : "#ef4444",
            fontWeight: "bold",
            }}
             >
            {player.overall ?? "-"}
</td>
 <td style={{ padding: "8px" }}>
     {player.contractText || "-"}
</td>
<td style={{ padding: "8px" }}>
  <div>
    <MovePlayerButtonAny
      playerId={player.id}
      targetRoster="AHL"
      label="Send Down"
    />
  </div>

  <div style={{ marginTop: "4px" }}>
    <TradeBlockButtonAny
      playerId={player.id}
      onTradeBlock={player.onTradeBlock ?? false}
    />
  </div>
  <div style={{ marginTop: "4px" }}>
  <WaiveButtonAny
    playerId={player.id}
  />
</div>
</td>

</tr>
     ))}
 </tbody>
 </table>
 <h2>NHL Defensemen ({nhlDefense.length})</h2>

<table
  style={{
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: "40px",
  }}
>
  <thead>
  <tr>
    <th style={{ width: "35%", textAlign: "left", padding: "8px" }}>
      Name
    </th>

    <th style={{ width: "15%", textAlign: "left", padding: "8px" }}>
      Pos
    </th>

    <th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
      Age
    </th>

    <th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
      OVR
    </th>

    <th style={{ width: "20%", textAlign: "left", padding: "8px" }}>
      Contract
    </th>

    <th style={{ textAlign: "left", padding: "8px" }}>
      Action
    </th>
  </tr>
</thead>

<tbody>
   {nhlDefense.map((player: any) => (
<tr
   key={player.id}
   style={{
   borderTop: "1px solid #334155",
   }}
   >
<td style={{ padding: "8px" }}>
<Link href={`/players/${player.slug}`}>
     {player.name}
</Link>
</td>
<td style={{ padding: "8px" }}>
    {player.positions || player.position}
</td>
<td style={{ padding: "8px" }}>
   {player.age ?? "-"}
</td>
 <td
  style={{
    padding: "8px",
    color:
      (player.overall ?? 0) >= 80
        ? "#22c55e"
        : (player.overall ?? 0) >= 70
        ? "#eab308"
        : "#ef4444",
    fontWeight: "bold",
  }}
>
  {player.overall ?? "-"}
</td>

<td style={{ padding: "8px" }}>
  {player.contractText || "-"}
</td>


<td style={{ padding: "8px" }}>
  <MovePlayerButton
    playerId={player.id}
    targetRoster="AHL"
    label="Send Down"
  />

  <br />

  <TradeBlockButton
    playerId={player.id}
    onTradeBlock={player.onTradeBlock ?? false}
  />
</td>



      </tr>
    ))}
  </tbody>
</table>
<h2>NHL Goalies ({nhlGoalies.length})</h2>

<table
  style={{
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: "40px",
  }}
>
  <thead>
  <tr>
    <th style={{ width: "35%", textAlign: "left", padding: "8px" }}>
      Name
    </th>

    <th style={{ width: "15%", textAlign: "left", padding: "8px" }}>
      Pos
    </th>

    <th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
      Age
    </th>

    <th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
      OVR
    </th>

    <th style={{ width: "20%", textAlign: "left", padding: "8px" }}>
      Contract
    </th>

    <th style={{ textAlign: "left", padding: "8px" }}>
      Action
    </th>
  </tr>
</thead>

  <tbody>
    {nhlGoalies.map((player: any) => (
      <tr
        key={player.id}
        style={{
          borderTop: "1px solid #334155",
        }}
      >
        <td style={{ padding: "8px" }}>
          <Link href={`/players/${player.slug}`}>
            {player.name}
          </Link>
        </td>

        <td style={{ padding: "8px" }}>
          {player.position}
        </td>

        <td style={{ padding: "8px" }}>
          {player.age ?? "-"}
        </td>

        <td
  style={{
    padding: "8px",
    color:
      (player.overall ?? 0) >= 80
        ? "#22c55e"
        : (player.overall ?? 0) >= 70
        ? "#eab308"
        : "#ef4444",
    fontWeight: "bold",
  }}
>
  {player.overall ?? "-"}
</td>
<td style={{ padding: "8px" }}>
  {player.contractText || "-"}
</td>

<td style={{ padding: "8px" }}>
  <MovePlayerButton
    playerId={player.id}
    targetRoster="AHL"
    label="Send Down"
  />

  <br />

  <TradeBlockButton
    playerId={player.id}
    onTradeBlock={player.onTradeBlock ?? false}
  />
</td>


      </tr>
    ))}
  </tbody>
</table>
  </>)}
{team.league === "AHL" && (
  <>


  {team.league === "AHL" && (
  <>

      <h2>AHL Forwards ({ahlForwards.length})</h2>

      <table
  style={{
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: "40px",
  }}
>
  <thead>
    <tr>
      <th style={{ width: "40%", textAlign: "left", padding: "8px" }}>
  Name
</th>

<th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
  Pos
</th>

<th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
  Age
</th>

<th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
  OVR
</th>

<th style={{ width: "20%", textAlign: "left", padding: "8px" }}>
  Contract
</th>

<th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
  Action
</th>
  </tr>
  </thead>


  <tbody>
    {ahlForwards.map((player: any) => (
      <tr
        key={player.id}
        style={{
          borderTop: "1px solid #334155",
        }}
      >
        <td style={{ padding: "8px" }}>
          <Link href={`/players/${player.slug}`}>
            {player.name}
          </Link>
        </td>

        <td style={{ padding: "8px" }}>
          {player.positions || player.position}
        </td>

        <td style={{ padding: "8px" }}>
          {player.age ?? "-"}
        </td>

        <td
  style={{
    padding: "8px",
    color:
      (player.overall ?? 0) >= 80
        ? "#22c55e"
        : (player.overall ?? 0) >= 70
        ? "#eab308"
        : "#ef4444",
    fontWeight: "bold",
  }}
>
  {player.overall ?? "-"}
</td>
<td style={{ padding: "8px" }}>
  {player.contractText || "-"}
</td>

<td style={{ padding: "8px" }}>
  <MovePlayerButton
    playerId={player.id}
    targetRoster="NHL"
    label="Call Up"
  />
</td>
      </tr>
    ))}
  </tbody>
</table>
<h2>AHL Defensemen ({ahlDefense.length})</h2>

<table
  style={{
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: "40px",
  }}
>
  <thead>
    <tr>
      <th style={{ width: "40%", textAlign: "left", padding: "8px" }}>
  Name
</th>

<th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
  Pos
</th>

<th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
  Age
</th>

<th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
  OVR
</th>

<th style={{ width: "20%", textAlign: "left", padding: "8px" }}>
  Contract
</th>

<th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
  Action
</th>
    </tr>
  </thead>

  <tbody>
    {ahlDefense.map((player: any) => (
      <tr
        key={player.id}
        style={{
          borderTop: "1px solid #334155",
        }}
      >
        <td style={{ padding: "8px" }}>
          <Link href={`/players/${player.slug}`}>
            {player.name}
          </Link>
        </td>

        <td style={{ padding: "8px" }}>
          {player.positions || player.position}
        </td>

        <td style={{ padding: "8px" }}>
          {player.age ?? "-"}
        </td>

        <td style={{ padding: "8px" }}>
          {player.overall ?? "-"}
        </td>
        <td style={{ padding: "8px" }}>
  {player.contractText || "-"}
</td>

<td style={{ padding: "8px" }}>
  <MovePlayerButton
    playerId={player.id}
    targetRoster="NHL"
    label="Call Up"
  />
</td>
      </tr>
    ))}
  </tbody>
</table>
<h2>AHL Goalies ({ahlGoalies.length})</h2>

<table
  style={{
    width: "100%",
    borderCollapse: "collapse",
    marginBottom: "40px",
  }}
>
  <thead>
    <tr>
     <th style={{ width: "40%", textAlign: "left", padding: "8px" }}>
  Name
</th>

<th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
  Pos
</th>

<th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
  Age
</th>

<th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
  OVR
</th>

<th style={{ width: "20%", textAlign: "left", padding: "8px" }}>
  Contract
</th>

<th style={{ width: "10%", textAlign: "left", padding: "8px" }}>
  Action
</th>

 </tr>
 </thead>
 <tbody>
  {ahlGoalies.map((player: any) => (
  <tr
  key={player.id}
  style={{
          borderTop: "1px solid #334155",
 }}
  >
  <td style={{ padding: "8px" }}>
          <Link href={`/players/${player.slug}`}>
            {player.name}
          </Link>
  </td>
  <td style={{ padding: "8px" }}>
          {player.position}
  </td>
  <td style={{ padding: "8px" }}>
          {player.age ?? "-"}
  </td>
   <td style={{ padding: "8px" }}>
          {player.overall ?? "-"}
   </td>
  <td style={{ padding: "8px" }}>
  {player.contractText || "-"}
</td>

<td style={{ padding: "8px" }}>
  <MovePlayerButton
    playerId={player.id}
    targetRoster="NHL"
    label="Call Up"
  />
</td>
</tr>
    ))}
  </tbody>
</table>

</>
)}

  </>)}

 
    </main>
  );
}