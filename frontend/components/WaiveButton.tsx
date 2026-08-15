"use client";

import { waivePlayer } from "@/app/actions/waive-player";

export default function WaiveButton({
  playerId,
}: {
  playerId: number;
}) {
  return (
    <button
      onClick={async () => {
        console.log("WAIVE CLICK", playerId);

        await waivePlayer(playerId);

        window.location.reload();
      }}
      style={{
        padding: "4px 8px",
        backgroundColor: "#ef4444",
        color: "white",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
      }}
    >
      Waive
    </button>
  );
}