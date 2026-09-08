"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { REMEMBER_TOKEN_KEY } from "@/lib/session-resume-shared";

/** Mounted (in the root layout, and directly on the Messages page — see its comment)
 *  when the server-rendered page thinks nobody's signed in. Some iOS Safari sessions
 *  drop the httpOnly session cookie mid-browse for reasons that have resisted several
 *  server-side fixes (see the long comment trail in lib/auth.ts) — this is the
 *  belt-and-suspenders fallback: LoginForm also stashes the same signed session token
 *  in localStorage, which isn't subject to whatever is pruning the cookie. If we land
 *  here with that token still present, the cookie almost certainly just got dropped
 *  rather than the GM actually choosing to log out (logging out clears the token too —
 *  see MegaMenu's Log out handler), so silently ask the server to reissue the cookie
 *  and reload, instead of making the GM type their password in again. A real full
 *  navigation (not router.refresh()) is used to reload, matching the same "iOS Safari
 *  doesn't reliably commit a Set-Cookie from anything but a top-level navigation"
 *  lesson LoginForm already learned.
 *
 *  Pass `children` (e.g. a "please sign in" block) to have this GATE that fallback UI
 *  instead of just running invisibly: it stays hidden while a resume attempt is in
 *  flight, so a GM whose cookie merely dropped never sees the alarming "sign in" wall
 *  flash up before silently reloading into the signed-in view a moment later — it only
 *  appears once we're sure there's genuinely nothing to recover (no token, or the
 *  token turned out to be invalid). useLayoutEffect (not useEffect) does the
 *  synchronous localStorage check before the browser's first paint, so even the
 *  no-token case shows its children immediately rather than one tick late. */
export default function SessionResume({ children }: { children?: React.ReactNode }) {
  const attempted = useRef(false);
  const [settled, setSettled] = useState(false);

  useLayoutEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    let token: string | null = null;
    try { token = localStorage.getItem(REMEMBER_TOKEN_KEY); } catch { setSettled(true); return; }
    if (!token) { setSettled(true); return; }

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
          setSettled(true);
        }
      })
      .catch(() => setSettled(true)); // network hiccup — this mount is done trying; the next page gets a fresh attempt
  }, []);

  if (children === undefined) return null; // plain background-watcher usage (root layout)
  return settled ? <>{children}</> : null;
}
