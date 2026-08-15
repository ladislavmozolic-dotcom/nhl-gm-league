"use client";

import { useState } from "react";
import { createTrade } from "@/app/actions/create-trade";

export default function CreateTradeForm({
  teams,
}: {
  teams: {
    id: number;
    name: string;
  }[];
}) {
  const [fromTeamId, setFromTeamId] = useState(
    teams[0]?.id ?? 0
  );

  const [toTeamId, setToTeamId] = useState(
    teams[1]?.id ?? teams[0]?.id ?? 0
  );

  return (
    <div
      style={{
        maxWidth: "600px",
        background: "#111827",
        border: "1px solid #374151",
        borderRadius: "12px",
        padding: "24px",
        marginTop: "20px",
      }}
    >
      <p
        style={{
          marginBottom: "8px",
          fontWeight: "bold",
        }}
      >
        From Team
      </p>

      <select
        value={fromTeamId}
        onChange={(e) =>
          setFromTeamId(Number(e.target.value))
        }
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "8px",
          background: "#1f2937",
          color: "white",
          border: "1px solid #4b5563",
        }}
      >
        {teams.map((team) => (
          <option
            key={team.id}
            value={team.id}
          >
            {team.name}
          </option>
        ))}
      </select>

      <div style={{ height: "20px" }} />

      <p
        style={{
          marginBottom: "8px",
          fontWeight: "bold",
        }}
      >
        To Team
      </p>

      <select
        value={toTeamId}
        onChange={(e) =>
          setToTeamId(Number(e.target.value))
        }
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "8px",
          background: "#1f2937",
          color: "white",
          border: "1px solid #4b5563",
        }}
      >
        {teams.map((team) => (
          <option
            key={team.id}
            value={team.id}
          >
            {team.name}
          </option>
        ))}
      </select>

      <button
        onClick={async () => {
          if (fromTeamId === toTeamId) {
            alert(
              "From Team and To Team cannot be the same."
            );
            return;
          }

          await createTrade(
            fromTeamId,
            toTeamId
          );

          window.location.href = "/trades";
        }}
        style={{
          width: "100%",
          marginTop: "24px",
          padding: "12px",
          backgroundColor: "#2563eb",
          color: "white",
          border: "none",
          borderRadius: "8px",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "16px",
        }}
      >
        Create Trade
      </button>
    </div>
  );
}