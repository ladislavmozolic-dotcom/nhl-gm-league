export default function ComingSoon({ title, points }: { title: string; points: string[] }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-8 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400">PLANNED</span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      <p className="text-slate-400 text-sm mb-4">This section is scaffolded. Planned contents:</p>
      <ul className="space-y-1.5">
        {points.map((p, i) => (
          <li key={i} className="text-sm text-slate-300 flex gap-2"><span className="text-slate-600">•</span>{p}</li>
        ))}
      </ul>
    </div>
  );
}
