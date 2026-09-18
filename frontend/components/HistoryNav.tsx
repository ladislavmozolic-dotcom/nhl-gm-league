import Link from "next/link";

type Props = {
  active: "history" | "records" | "hof" | "awards";
  league?: "NHL" | "AHL";
};

export default function HistoryNav({ active, league = "NHL" }: Props) {
  const tabs = [
    { key: "history", label: "Sezóny", href: "/history", icon: "🕰️" },
    { key: "records", label: "Rekordy", href: `/history/records${league === "AHL" ? "?league=AHL" : ""}`, icon: "📜" },
    { key: "hof", label: "Hall of Fame", href: "/hall-of-fame", icon: "🏅" },
    { key: "awards", label: "Ocenenia", href: "/awards", icon: "🏵️" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3 mb-6">
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              isActive
                ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-700/50"
            }`}
          >
            <span className="text-sm">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
