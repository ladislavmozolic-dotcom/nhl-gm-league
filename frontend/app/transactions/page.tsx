import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";

export default async function TransactionsPage() {
  const transactions = await prisma.transaction.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Transactions" subtitle="Recent league activity and moves" />

      {transactions.length === 0 ? (
        <Card>
          <div className="p-8 text-center">
            <p className="text-slate-500 text-lg">No transactions yet</p>
            <p className="text-slate-600 text-sm mt-2">Transactions will appear here once the season starts</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-4 p-4 bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 hover:border-slate-600 transition-colors"
            >
              <div
                className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  tx.type === "TRADE"
                    ? "bg-green-500"
                    : tx.type === "SIGNING"
                    ? "bg-blue-500"
                    : tx.type === "WAIVER"
                    ? "bg-yellow-500"
                    : "bg-slate-500"
                }`}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium">{tx.message}</p>
                <p className="text-xs text-slate-500 mt-0.5">{tx.type}</p>
              </div>
              <p className="text-xs text-slate-500 flex-shrink-0">
                {tx.createdAt.toLocaleDateString("sk-SK", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}