"use client";

import { useEffect } from "react";

/** On the Schedule, jump the viewport to the current day (#current-day) on load, so
 *  after a sim the admin lands on the next games to play — previous games are above
 *  (scroll up), upcoming below (scroll down). */
export default function ScrollToCurrent() {
  useEffect(() => {
    const el = document.getElementById("current-day");
    if (el) el.scrollIntoView({ block: "start", behavior: "auto" });
  }, []);
  return null;
}
