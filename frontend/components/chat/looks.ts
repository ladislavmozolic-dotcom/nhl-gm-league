"use client";
import { Fredoka, Pacifico, Caveat, Bangers } from "next/font/google";

// Fonts are self-hosted by next/font at build time (no request to Google when the chat runs).
const fredoka = Fredoka({ subsets: ["latin", "latin-ext"], display: "swap" });
const pacifico = Pacifico({ weight: "400", subsets: ["latin", "latin-ext"], display: "swap" });
const caveat = Caveat({ subsets: ["latin", "latin-ext"], display: "swap" });
const bangers = Bangers({ weight: "400", subsets: ["latin", "latin-ext"], display: "swap" });

// Backgrounds are semi-transparent over the theme colour, so they work in dark AND light mode and bubbles stay readable.
export const BACKGROUNDS: Record<string, { label: string; css: string; swatch: string }> = {
  none: { label: "Žiadne", css: "", swatch: "linear-gradient(135deg,#334155,#0f172a)" },
  rainbow: { label: "Dúha 🌈", css: "linear-gradient(160deg, rgba(228,3,3,.80) 0%, rgba(255,140,0,.80) 17%, rgba(255,237,0,.75) 34%, rgba(0,160,50,.78) 51%, rgba(0,77,255,.78) 68%, rgba(140,20,170,.80) 100%)", swatch: "linear-gradient(135deg,#e40303,#ff8c00,#ffed00,#008026,#004dff,#750787)" },
  sunset: { label: "Západ slnka", css: "linear-gradient(170deg, rgba(255,94,98,.65), rgba(255,153,102,.60) 45%, rgba(120,80,200,.65))", swatch: "linear-gradient(135deg,#ff5e62,#ff9966,#7850c8)" },
  ocean: { label: "Oceán", css: "linear-gradient(170deg, rgba(0,198,255,.35), rgba(0,114,255,.40) 60%, rgba(20,30,120,.45))", swatch: "linear-gradient(135deg,#00c6ff,#0072ff,#14297a)" },
  ice: { label: "Ľad", css: "linear-gradient(170deg, rgba(190,230,255,.40), rgba(120,190,240,.30) 55%, rgba(220,240,255,.35))", swatch: "linear-gradient(135deg,#bee6ff,#78bef0,#dcf0ff)" },
  forest: { label: "Les", css: "linear-gradient(170deg, rgba(17,153,142,.40), rgba(56,239,125,.25) 55%, rgba(10,80,60,.45))", swatch: "linear-gradient(135deg,#11998e,#38ef7d,#0a503c)" },
  neon: { label: "Neón", css: "linear-gradient(170deg, rgba(255,0,200,.60), rgba(0,230,255,.55) 55%, rgba(120,0,255,.65))", swatch: "linear-gradient(135deg,#ff00c8,#00e6ff,#7800ff)" },
};

export const FONTS: Record<string, { label: string; body: string; title: string }> = {
  default: { label: "Štandardné", body: "", title: "" },
  party: { label: "Párty", body: fredoka.style.fontFamily, title: pacifico.style.fontFamily },
  hand: { label: "Rukopis", body: caveat.style.fontFamily, title: caveat.style.fontFamily },
  comic: { label: "Komiks", body: fredoka.style.fontFamily, title: bangers.style.fontFamily },
};
