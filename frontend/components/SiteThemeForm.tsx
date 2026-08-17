"use client";

import { useState, useTransition } from "react";
import { type Theme, THEME_DEFAULTS, FONTS, fontStack } from "@/lib/site-theme";
import { saveTheme } from "@/app/admin/site-editor/actions";

/** Full theme editor — colours, font, roundness — with a LIVE PREVIEW rendered from
 *  the current (unsaved) values so the admin sees it before saving. */
export default function SiteThemeForm({ theme }: { theme: Theme }) {
  const [t, setT] = useState<Theme>(theme);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof Theme>(k: K, v: Theme[K]) => { setT((p) => ({ ...p, [k]: v })); setSaved(false); };
  const save = () => start(async () => { await saveTheme(t); setSaved(true); });
  const reset = () => { setT(THEME_DEFAULTS); setSaved(false); };

  const swatch = (label: string, key: keyof Theme) => (
    <div>
      <span className="text-xs text-slate-400 block mb-1">{label}</span>
      <div className="flex gap-2 items-center">
        <input type="color" value={String(t[key])} onChange={(e) => set(key, e.target.value as Theme[typeof key])} className="h-9 w-12 rounded bg-slate-800 border border-slate-700 shrink-0" />
        <input value={String(t[key])} onChange={(e) => set(key, e.target.value as Theme[typeof key])} className="w-full px-2 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs" />
      </div>
    </div>
  );

  const font = fontStack(t.fontKey);
  const radius = t.radiusPx;
  return (
    <div className="space-y-5">
      {/* LIVE PREVIEW — inline styles from state, independent of the global theme */}
      <div className="rounded-xl overflow-hidden border border-slate-700">
        <div className="p-5" style={{ background: t.bgColor, fontFamily: font || undefined }}>
          <div className="text-[10px] uppercase tracking-widest mb-3" style={{ color: t.text3Color }}>Živý náhľad</div>
          <div className="p-4 mb-3" style={{ background: t.surfaceColor, border: `1px solid ${t.borderColor}`, borderRadius: radius + 4 }}>
            <div className="text-lg font-bold text-white mb-1">Nadpis karty</div>
            <div className="text-sm mb-2" style={{ color: t.text2Color }}>Sekundárny text — popis alebo label.</div>
            <div className="text-xs mb-3" style={{ color: t.text3Color }}>Tlmený text — poznámka, dátum.</div>
            <div className="flex gap-2 items-center">
              <input placeholder="Vstupné pole" className="text-sm px-3 py-1.5 flex-1" style={{ background: t.surface2Color, border: `1px solid ${t.borderColor}`, borderRadius: radius, color: "#fff" }} />
              <button className="text-sm font-semibold text-white px-3 py-1.5" style={{ background: t.accentColor, borderRadius: radius }}>Tlačidlo</button>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="text-xs px-2 py-1" style={{ background: t.surface2Color, color: t.text2Color, borderRadius: radius }}>Chip</span>
            <span className="text-xs px-2 py-1 font-semibold" style={{ color: t.accentColor }}>Akcentový odkaz →</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {swatch("Pozadie stránky", "bgColor")}
        {swatch("Karty / bunky", "surfaceColor")}
        {swatch("Inputy / sekundárne plochy", "surface2Color")}
        {swatch("Orámovanie", "borderColor")}
        {swatch("Sekundárny text", "text2Color")}
        {swatch("Tlmený text", "text3Color")}
        {swatch("Akcentová farba", "accentColor")}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="block"><span className="text-xs text-slate-400">Písmo</span>
          <select value={t.fontKey} onChange={(e) => set("fontKey", e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm">
            {FONTS.map((f) => <option key={f.key} value={f.key}>{f.name}</option>)}
          </select></label>
        <label className="block"><span className="text-xs text-slate-400">Zaoblenie rohov — {t.radiusPx}px</span>
          <input type="range" min={0} max={24} value={t.radiusPx} onChange={(e) => set("radiusPx", +e.target.value)} className="w-full accent-blue-500" /></label>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={pending} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold">{pending ? "Ukladám…" : "Uložiť tému"}</button>
        <button onClick={reset} className="text-sm text-slate-400 hover:text-white">Obnoviť predvolené</button>
        {saved && <span className="text-emerald-400 text-sm">✓ Uložené — obnov stránku pre plný efekt</span>}
      </div>
      <p className="text-[11px] text-slate-500">Téma sa aplikuje na celú stránku (karty, orámovania, text, rohy, písmo). Náhľad hore je presný. Niektoré farebné akcenty (zelená/červená pre stavy) zostávajú zámerne.</p>
    </div>
  );
}
