export default function LeagueExecutives() {
  const executives = [
    {
      name: "David Goldmann",
      role: "Commissioner",
    },
    {
      name: "Roman Chrencik",
      role: "Committee",
    },
    {
      name: "Alex Jurica",
      role: "League Staff",
    },
  ];

  return (
    <div className="card p-4">
      <h2 className="text-sm font-bold text-white mb-4">
        🏒 League Executives
      </h2>

      <div className="space-y-3">
        {executives.map((exec) => (
          <div
            key={exec.name}
            className="border-b border-slate-700/30 pb-2"
          >
            <p className="text-sm text-white font-medium">
              {exec.name}
            </p>

            <p className="text-xs text-slate-400">
              {exec.role}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}