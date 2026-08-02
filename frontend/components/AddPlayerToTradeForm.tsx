"use client";

import { useState } from "react";
import { addPlayerToTrade } from "@/app/actions/add-player-to-trade";

export default function AddPlayerToTradeForm({
  tradeId,
  side,
  players,
}: {
  tradeId: number;
  side: string;
  players: {
    id: number;
    name: string;
  }[];
}) {
  const [playerId, setPlayerId] = useState(
    players[0]?.id ?? 0
  );

  return (
    <div
      style={{
        marginTop: "16px",
      }}
    >
      <select
        value={playerId}
        onChange={(e) =>
          setPlayerId(Number(e.target.value))
        }
      >
        {players.map((player) => (
          <option
            key={player.id}
            value={player.id}
          >
            {player.name}
          </option>
        ))}
      </select>

      <button
        onClick={async () => {
          await addPlayerToTrade(
            tradeId,
            playerId,
            side
          );

          window.location.reload();
        }}
        style={{
          marginLeft: "10px",
        }}
      >
        Add Player
      </button>
    </div>
  );
}