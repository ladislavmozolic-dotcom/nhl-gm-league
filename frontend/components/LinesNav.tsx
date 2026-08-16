"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Header shared by the Line Editor and the Line Builder: team name + a toggle
// between the two views.
export default function LinesNav({ teamName, teamSlug }: { teamName: string; teamSlug: string }) {
  const path = usePathname() ?? "";
  const onBuilder = path.endsWith("/builder");
  const Tab = ({ href, label, active }: { href: string; label: string; active: boolean }) => (
    <Link href={href} className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${active ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>{label}</Link>
  );
  return (
    <div className="mb-4">
      <div className="flex items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">{teamName}</h1>
        <div className="flex gap-1 bg-slate-800/70 border border-slate-700 rounded-lg p-1">
          <Tab href={`/teams/${teamSlug}/lines`} label="Line Editor" active={!onBuilder} />
          <Tab href={`/teams/${teamSlug}/lines/builder`} label="Line Builder" active={onBuilder} />
        </div>
      </div>
      <Link href={`/teams/${teamSlug}`} className="text-sm text-slate-400 hover:text-blue-400">← back to team</Link>
    </div>
  );
}
