import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function TradesPage() {
  const trades = await (prisma as any).trade.findMany({
  orderBy: {
    createdAt: "desc",
  },
});
  return (
    <main
      style={{
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "24px",
      }}
    >
      <h1>Trades</h1>

      <p>
        Create and manage trades.
      </p>

      <Link href="/trades/new">
        Create Trade
      </Link>

      <p> 
        Trades ({trades.length})
      </p>
      
      {trades.map((trade: any) => (
  <div
    key={trade.id}
    style={{
      border: "1px solid #334155",
      padding: "12px",
      marginTop: "12px",
    }}
  >
    <Link href={`/trades/${trade.id}`}>
      Trade #{trade.id}
    </Link>

    <p>
      Status: {trade.status}
    </p>
  </div>
))}Zobraziť viac riadkov

    </main>
  );
}