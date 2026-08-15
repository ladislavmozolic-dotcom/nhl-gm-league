import Link from "next/link";
import { PageHeader } from "@/components/ui";

const tools = [
  {
    title: "All Rosters",
    description: "View complete rosters for all teams in one place",
    href: "/tools/all-rosters",
    icon: "👥",
  },
  {
    title: "Player Compare",
    description: "Search up to five skaters or goalies and compare them attribute by attribute",
    href: "/tools/compare",
    icon: "⚖️",
  },
];

export default function ToolsPage() {
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Tools" subtitle="League management utilities" />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 p-6 hover:border-slate-600 transition-all group"
          >
            <div className="text-3xl mb-3">{tool.icon}</div>
            <h3 className="text-lg font-bold group-hover:text-blue-400 transition-colors">{tool.title}</h3>
            <p className="text-sm text-slate-400 mt-1">{tool.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}