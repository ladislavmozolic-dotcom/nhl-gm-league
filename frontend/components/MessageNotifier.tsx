"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { unreadDmInfo } from "@/app/messages/actions";
import { REMEMBER_TOKEN_KEY } from "@/lib/session-resume-shared";

/**
 * Global, always-on message watcher for a signed-in GM. Polls the unread-DM count
 * every few seconds; when a NEW message arrives (count goes up) it pops a browser
 * notification and soft-refreshes the page — so an idle GM on any page (incl. the
 * home page) sees the message land without clicking anything. Renders nothing.
 *
 * This component, once mounted, also happens to be the thing keeping a heartbeat
 * going through client-side (Link) navigations that DON'T re-run the root layout —
 * so it's also the fallback session-resume's actual trigger point. SessionResume
 * (mounted only when the layout renders with no GM) covers a fresh/full page load
 * with a dead cookie, but Next's App Router doesn't re-execute the root layout on a
 * same-layout soft navigation, so a cookie that dies WHILE already on a page (e.g.
 * right before clicking Messages) never makes the layout re-render with `gm` null —
 * SessionResume then simply never mounts, and the GM hits a "sign in" wall with
 * nothing trying to recover it. This poll loop, already alive from the last full
 * load, is what actually notices: `unreadDmInfo()` reports `ok: false` once the
 * cookie the server sees is gone, at which point it's this tick that hands the
 * localStorage remember-token back to the server instead.
 */
export default function MessageNotifier({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const lastRef = useRef(initialUnread);
  const resuming = useRef(false);

  useEffect(() => {
    // ask once for notification permission (no-op if already decided)
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    let stopped = false;
    const tryResume = async () => {
      if (resuming.current) return;
      let token: string | null = null;
      try { token = localStorage.getItem(REMEMBER_TOKEN_KEY); } catch { return; }
      if (!token) return;
      resuming.current = true;
      try {
        const res = await fetch("/api/auth/resume", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
        });
        const body = await res.json().catch(() => ({ ok: false }));
        if (body?.ok) {
          window.location.reload(); // full nav — the only reliable way to commit the reissued cookie on iOS Safari
        } else {
          try { localStorage.removeItem(REMEMBER_TOKEN_KEY); } catch { /* ignore */ }
          resuming.current = false;
        }
      } catch {
        resuming.current = false; // network hiccup — this tick will just try again next time
      }
    };
    const tick = async () => {
      const r = await unreadDmInfo().catch(() => null);
      if (stopped) return;
      if (!r || !r.ok) { await tryResume(); return; }
      if (r.count > lastRef.current) {
        // new message(s) arrived while idle → notify + refresh the page
        if ("Notification" in window && Notification.permission === "granted") {
          const n = new Notification("UNHL — new message", {
            body: r.from ? `New message from ${r.from}` : `You have ${r.count} unread message${r.count === 1 ? "" : "s"}.`,
            tag: "unhl-dm",
          });
          n.onclick = () => { window.focus(); window.location.href = "/messages"; };
        }
        router.refresh();
      } else if (r.count < lastRef.current) {
        // count went DOWN (read elsewhere — another tab, another device, or Messenger's
        // own read-marking hasn't reached this poll yet) — no notification, but still
        // refresh so a stuck-lit nav badge catches up within one tick instead of staying
        // wrong until something else happens to trigger a refresh.
        router.refresh();
      }
      lastRef.current = r.count;
    };
    const id = setInterval(tick, 8000);
    // also fire soon after mount so a message that arrived just before load is caught
    const kick = setTimeout(tick, 2000);
    // re-check when the tab regains focus
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => { stopped = true; clearInterval(id); clearTimeout(kick); window.removeEventListener("focus", onFocus); };
  }, [router]);

  return null;
}
