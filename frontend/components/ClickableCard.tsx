"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** A whole-card link (`router.push` on click) for a card that also needs REAL
 *  `<a>`/`<Link>` elements inside it (e.g. asset chips linking to a player or an
 *  external site) — those can't be nested inside an actual `<a>` (invalid HTML,
 *  and the outer link would swallow their clicks), so the card itself is a plain
 *  `<div>` instead. Give any inner link its own `onClick={(e) => e.stopPropagation()}`
 *  or its click also triggers this card's navigation to `href`. */
export default function ClickableCard({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <div
      role="link" tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(href); }}
      className={className}
    >
      {children}
    </div>
  );
}
