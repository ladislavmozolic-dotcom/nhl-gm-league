"use client";

import { toggleTradeBlock } from "@/app/actions/toggle-trade-block";

export default function TradeBlockButton({
  playerId,
  onTradeBlock,
}: {
  playerId: number;
  onTradeBlock: boolean;
}) {
  return (
    <button
      onClick={async () => {
        await toggleTradeBlock(
          playerId,
          !onTradeBlock
        );

        window.location.reload();
      }}
      style={{
        padding: "4px 8px",
        borderRadius: "6px",
        cursor: "pointer",
      }}
    >
      {onTradeBlock
        ? "Remove Block"
        : "Trade Block"}
    </button>
  );
}
``