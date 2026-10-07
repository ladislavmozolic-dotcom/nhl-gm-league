import Link from "next/link";

export type Crumb = {
  label: string;
  href?: string;
  icon?: string;
};

export default function ForumBreadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-slate-400 py-1.5 px-3 rounded-lg bg-slate-900/60 border border-slate-800/80 w-fit max-w-full overflow-x-auto shadow-sm">
      <Link
        href="/forum"
        className="flex items-center gap-1 hover:text-blue-400 font-semibold transition-colors shrink-0"
      >
        <span>🏛️</span>
        <span>Board index</span>
      </Link>
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5 shrink-0">
          <span className="text-slate-600 font-bold">›</span>
          {c.href ? (
            <Link
              href={c.href}
              className="hover:text-blue-400 font-medium transition-colors flex items-center gap-1"
            >
              {c.icon && <span>{c.icon}</span>}
              <span className="truncate max-w-[200px] sm:max-w-[320px]">{c.label}</span>
            </Link>
          ) : (
            <span className="text-slate-200 font-semibold flex items-center gap-1 truncate max-w-[200px] sm:max-w-[320px]">
              {c.icon && <span>{c.icon}</span>}
              <span className="truncate">{c.label}</span>
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
