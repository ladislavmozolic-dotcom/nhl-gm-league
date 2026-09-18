import Link from "next/link";
import { getLang } from "@/lib/lang-server";
import { type Lang } from "@/lib/i18n";

type Props = {
  active: "history" | "records" | "hof" | "awards";
  league?: "NHL" | "AHL";
  lang?: Lang;
};

export default async function HistoryNav({ active, league = "NHL", lang: propLang }: Props) {
  const lang = propLang ?? (await getLang());

  const tabs = [
    {
      key: "history",
      label: lang === "cs" ? "Sezóny" : lang === "de" ? "Saisons" : lang === "ru" ? "Сезоны" : "Seasons",
      href: "/history",
      icon: "🕰️",
    },
    {
      key: "records",
      label: lang === "cs" ? "Rekordy" : lang === "de" ? "Rekorde" : lang === "ru" ? "Рекорды" : "Records",
      href: `/history/records${league === "AHL" ? "?league=AHL" : ""}`,
      icon: "📜",
    },
    {
      key: "hof",
      label: lang === "cs" ? "Sieň slávy" : lang === "de" ? "Ruhmeshalle" : lang === "ru" ? "Зал славы" : "Hall of Fame",
      href: "/hall-of-fame",
      icon: "🏅",
    },
    {
      key: "awards",
      label: lang === "cs" ? "Ocenenia" : lang === "de" ? "Auszeichnungen" : lang === "ru" ? "Награды" : "Awards",
      href: "/awards",
      icon: "🏵️",
    },
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
