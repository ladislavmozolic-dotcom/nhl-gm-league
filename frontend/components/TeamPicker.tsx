"use client";

export default function TeamPicker({ side, current, teams }: { side: "a" | "b"; current: string; teams: { slug: string; name: string }[] }) {
  return (
    <select
      defaultValue={current}
      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm font-semibold"
      onChange={(e) => {
        const url = new URL(window.location.href);
        url.searchParams.set(side, e.target.value);
        window.location.href = url.toString();
      }}
    >
      {teams.map((t) => <option key={t.slug} value={t.slug}>{t.name}</option>)}
    </select>
  );
}
