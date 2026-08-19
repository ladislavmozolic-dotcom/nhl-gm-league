"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { unreadDmInfo } from "@/app/messages/actions";

/**
 * Global, always-on message watcher for a signed-in GM. Polls the unread-DM count
 * every few seconds; when a NEW message arrives (count goes up) it pops a browser
 * notification and soft-refreshes the page — so an idle GM on any page (incl. the
 * home page) sees the message land without clicking anything. Renders nothing.
 */
export default function MessageNotifier({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const lastRef = useRef(initialUnread);

  useEffect(() => {
    // ask once for notification permission (no-op if already decided)
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    let stopped = false;
    const tick = async () => {
      const r = await unreadDmInfo().catch(() => null);
      if (stopped || !r || !r.ok) return;
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
