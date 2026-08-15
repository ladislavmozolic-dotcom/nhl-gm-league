"use client";

import { movePlayer } from "@/app/actions/move-player";

export default function MovePlayerButton({
  playerId,
  targetRoster,
  label,
}: {
  playerId: number;
  targetRoster: "NHL" | "AHL";
  label: string;
}) {
  return (
    <button
      onClick={async () => {
        await movePlayer(playerId, targetRoster);
        window.location.reload();
      }}
      style={{
        padding: "4px 8px",
        borderRadius: "6px",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}