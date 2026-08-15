import { prisma } from "@/lib/prisma";

export default async function RecentSignings() {
  const signings = await prisma.transaction.findMany({
    where: {
      type: "signing",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
  });

  return (
    <div className="card p-4">
      <h2 className="text-sm font-bold text-white mb-4">
        ✍️ Recent Signings
      </h2>

      {signings.length === 0 ? (
        <p className="text-xs text-slate-400">
          No recent signings found.
        </p>
      ) : (
        <div className="space-y-3">
          {signings.map((item) => (
            <div
              key={item.id}
              className="border-b border-slate-700/30 pb-2"
            >
              <p className="text-sm text-white">
                {item.message}
              </p>

              <p className="text-xs text-slate-400">
                {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}