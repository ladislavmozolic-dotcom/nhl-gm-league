"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Return link that goes back to the PREVIOUS page when you arrived here via an
 * in-app link (browser history), and falls back to a fixed parent (`fallback`)
 * on a direct visit / new tab / external referrer.
 *
 * SSR renders the fallback label + href (works with no JS, middle-click, SEO).
 * After mount, if the referrer is same-origin and there's history to pop, the
 * link switches to "Back" and pops the stack instead.
 */
export default function BackLink({ fallback, label }: { fallback: string; label: string }) {
  const router = useRouter();
  const [canBack, setCanBack] = useState(false);

  useEffect(() => {
    try {
      const sameOrigin = document.referrer && new URL(document.referrer).origin === window.location.origin;
      if (sameOrigin && window.history.length > 1) setCanBack(true);
    } catch { /* referrer may be opaque */ }
  }, []);

  return (
    <Link
      href={fallback}
      onClick={(e) => { if (canBack) { e.preventDefault(); router.back(); } }}
      className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors"
    >
      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
      {canBack ? "Back" : label}
    </Link>
  );
}
