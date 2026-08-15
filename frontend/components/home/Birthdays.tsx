import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { cleanName } from "@/lib/playerName";

export default async function Birthdays() {
  const today = new Date();
  const m = today.getMonth(), d = today.getDate();

  const rows = await prisma.player.findMany({
    where: { birthDate: { not: null } },
    select: { id: true, name: true, slug: true, birthDate: true },
  });

  // players whose birthday (month + day) is today, with the age they turn
  const celebrants = rows
    .map((p) => {
      const b = p.birthDate as Date;
      return { ...p, b };
    })
    .filter((p) => p.b.getUTCMonth() === m && p.b.getUTCDate() === d)
    .map((p) => ({ ...p, turning: today.getFullYear() - p.b.getUTCFullYear() }))
    .sort((a, b) => a.turning - b.turning);

  return (
    <div className="card p-4">
      <h2 className="text-sm font-bold text-white mb-4">🎂 Today&apos;s Birthdays</h2>

      {celebrants.length === 0 ? (
        <p className="text-xs text-slate-500">No birthdays today.</p>
      ) : (
        <div className="space-y-3">
          {celebrants.map((player) => (
            <div key={player.id} className="border-b border-slate-700/30 pb-2 last:border-0">
              <Link href={`/players/${player.slug}`} className="text-sm font-medium text-white hover:text-blue-400">
                {cleanName(player.name)}
              </Link>
              <p className="text-xs text-slate-400">turns {player.turning} today</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
