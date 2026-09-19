import Link from "next/link";
import React from "react";

/**
 * Shared UI primitives matching the home-page design language.
 * Card / StatTile / SectionTitle / PageHeader — use these across pages
 * so every screen shares the same look (dark slate cards, uppercase labels).
 */

export function Card({
  title,
  children,
  href,
  accent,
  right,
  className = "",
  bodyClassName = "p-4",
}: {
  title?: string;
  children: React.ReactNode;
  href?: string;
  accent?: string;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`bg-slate-900/70 border border-slate-800 rounded-2xl shadow-lg shadow-black/20 overflow-hidden ${className}`}>
      {title && (
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-800/30">
          <h2 className={`text-sm font-bold uppercase tracking-wide ${accent ?? "text-slate-200"}`}>{title}</h2>
          {right ?? (href && <Link href={href} className="text-xs text-slate-400 hover:text-blue-400">view →</Link>)}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

export function StatTile({ label, value, sub, color }: { label: string; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg shadow-black/20">
      <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">{label}</p>
      <p className={`text-2xl font-black ${color ?? "text-white"} leading-none`}>{value}</p>
      {sub && <p className="text-sm text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export function SectionTitle({ children, count, accent, action }: { children: React.ReactNode; count?: number | string; accent?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className={`text-sm font-bold uppercase tracking-wider flex items-center gap-2 ${accent ?? "text-slate-400"}`}>
        {children}
        {count !== undefined && <span className="text-xs bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 normal-case tracking-normal">{count}</span>}
      </h3>
      {action}
    </div>
  );
}

/** A "back to X" link, styled as a small pill (chevron + label) instead of the
 *  plain "← text" links scattered around the app — use this everywhere a page
 *  links back to a parent/list page (PageHeader's `right` slot, a page's own
 *  top-left corner, etc.) so every return link looks the same. For a link that
 *  should pop real browser history when available (falling back to a fixed
 *  parent otherwise), use BackLink instead — this one always goes straight to
 *  `href`. */
/** #1/2/3 get a medal-colored circle; everyone else a plain slate one. Use for
 *  any ranked list (leaderboards, finance boards) instead of a bare number. */
export function RankBadge({ rank }: { rank: number }) {
  const tone =
    rank === 1 ? "bg-gradient-to-br from-yellow-300 to-yellow-600 text-yellow-950 shadow-[0_0_10px_-2px] shadow-yellow-500/50"
    : rank === 2 ? "bg-gradient-to-br from-slate-300 to-slate-500 text-slate-950"
    : rank === 3 ? "bg-gradient-to-br from-amber-600 to-amber-800 text-amber-50"
    : "bg-slate-800/80 text-slate-500";
  return <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black tabular-nums shrink-0 ${tone}`}>{rank}</span>;
}

const METER_TONES = { blue: "bg-blue-500", emerald: "bg-emerald-500", fuchsia: "bg-fuchsia-500", amber: "bg-amber-500", sky: "bg-sky-500", rose: "bg-rose-500", slate: "bg-slate-500" };
/** A thin rounded progress bar (0–100). Pairs a number with an at-a-glance
 *  visual weight — use anywhere a table shows a %, a share of a cap, etc. */
export function Meter({ pct, tone = "blue", className = "" }: { pct: number; tone?: keyof typeof METER_TONES; className?: string }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div className={`h-1.5 w-full rounded-full bg-slate-800 overflow-hidden ${className}`}>
      <div className={`h-full rounded-full ${METER_TONES[tone]}`} style={{ width: `${w}%` }} />
    </div>
  );
}

const PILL_TONES = {
  green: "bg-green-500/15 text-green-300 border-green-500/30",
  emerald: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  slate: "bg-slate-700/40 text-slate-300 border-slate-600/40",
  sky: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  rose: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};
/** A small rounded-pill status/category badge (team direction, pricing tier,
 *  signed/open, ...) — reads better in a table cell than plain colored text. */
export function Pill({ tone, children }: { tone: keyof typeof PILL_TONES; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${PILL_TONES[tone]}`}>{children}</span>;
}

/** A club's logo (if any) + name, sized for a table row. */
export function TeamCell({ logoUrl, name }: { logoUrl?: string | null; name: string }) {
  return (
    <span className="inline-flex items-center gap-2 min-w-0">
      {logoUrl ? (
        <img src={logoUrl} alt="" className="w-5 h-5 object-contain shrink-0" />
      ) : (
        <span className="w-5 h-5 rounded-full bg-slate-800 shrink-0" />
      )}
      <span className="font-semibold truncate">{name}</span>
    </span>
  );
}

export function BackPill({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link href={href}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-lg pl-2 pr-3 py-1.5 transition-colors whitespace-nowrap ${className}`}>
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      {children}
    </Link>
  );
}

export function PageHeader({ title, subtitle, right }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{title}</h1>
        {subtitle && <p className="text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
