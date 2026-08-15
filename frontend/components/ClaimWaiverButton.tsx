"use client";

import { claimWaiver } from "@/app/actions/claim-waiver";

export default function ClaimWaiverButton({
  playerId,
}: {
  playerId: number;
}) {
  return (
    <button
      onClick={async () => {
        await claimWaiver(playerId);
        window.location.reload();
      }}
      style={{
        padding: "4px 8px",
        borderRadius: "6px",
        cursor: "pointer",
      }}
    >
      Claim
    </button>
  );
}