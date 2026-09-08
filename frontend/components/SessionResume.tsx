"use client";

import { useEffect, useRef } from "react";
import { REMEMBER_TOKEN_KEY } from "@/lib/session-resume-shared";

/** Mounted (in the root layout) only when the server-rendered page thinks nobody's
 *  signed in. Some iOS Safari sessions drop the httpOnly session cookie mid-browse
 *  for reasons that have resisted several server-side fixes (see the long comment
 *  trail in lib/auth.ts) — this is the belt-and-suspenders fallback: LoginForm also
 *  stashes the same signed session token in localStorage, which isn't subject to
 *  whatever is pruning the cookie. If we land here with that token still present, the
 *  cookie almost certainly just got dropped rather than the GM actually choosing to
 *  log out (logging out clears the token too — see MegaMenu's Log out handler), so
 *  silently ask the server to reissue the cookie and reload, instead of making the GM
 *  type their password in again. A real full navigation (not router.refresh()) is
 *  used to reload, matching the same "iOS Safari doesn't reliably commit a Set-Cookie
 *  from anything but a top-level navigation" lesson LoginForm already learned. */
export default function SessionResume() {
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    let token: string | null = null;
    try { token = localStorage.getItem(REMEMBER_TOKEN_KEY); } catch { return; }
    if (!token) return;

    fetch("/api/auth/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json().catch(() => ({ ok: false })))
      .then((r) => {
        if (r?.ok) {
          window.location.reload();
        } else {
          // token no longer valid (team reassigned, etc.) — stop retrying every page load
          try { localStorage.removeItem(REMEMBER_TOKEN_KEY); } catch { /* ignore */ }
        }
      })
      .catch(() => { /* network hiccup — try again on the next page that mounts this */ });
  }, []);

  return null;
}
