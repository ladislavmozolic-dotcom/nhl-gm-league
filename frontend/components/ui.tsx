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
