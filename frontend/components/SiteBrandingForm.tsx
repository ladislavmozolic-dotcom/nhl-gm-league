"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Branding } from "@/lib/site-config";
import { BUILTIN_TEMPLATES, type TemplateStyle } from "@/lib/site-templates";
import { saveBranding, saveTemplate, deleteTemplate } from "@/app/admin/site-editor/actions";

export type SavedTemplate = { id: number; name: string; style: TemplateStyle };

/** Branding editor — templates, live preview, image uploads (logo + wordmark), colours. */
export default function SiteBrandingForm({ branding, savedTemplates }: { branding: Branding; savedTemplates: SavedTemplate[] }) {
  const router = useRouter();
  const [b, setB] = useState(branding);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"logo" | "name" | null>(null);
  const [tplName, setTplName] = useState("");
  const set = (k: keyof Branding, v: string) => { setB((p) => ({ ...p, [k]: v })); setSaved(false); };

  // apply a template's look (colours + banner layout) into the form; keeps content
  const applyStyle = (s: TemplateStyle) => { setB((p) => ({ ...p, accentColor: s.accentColor, bgColor: s.bgColor, bannerAlign: s.bannerAlign, bannerLayout: s.bannerLayout, logoFirst: s.logoFirst, logoHeight: s.logoHeight, nameHeight: s.nameHeight })); setSaved(false); };
  const currentStyle = (): TemplateStyle => ({ accentColor: b.accentColor, bgColor: b.bgColor, bannerAlign: b.bannerAlign, bannerLayout: b.bannerLayout, logoFirst: b.logoFirst, logoHeight: b.logoHeight, nameHeight: b.nameHeight });
  const saveTpl = () => start(async () => { await saveTemplate(tplName, currentStyle()); setTplName(""); router.refresh(); });
  const delTpl = (id: number) => start(async () => { await deleteTemplate(id); router.refresh(); });

  const upload = async (file: File | undefined, key: "logoUrl" | "nameImageUrl", which: "logo" | "name") => {
    setErr(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Musí to byť obrázok."); return; }
    setUploading(which);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/site-upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { setErr(j.error || "Upload zlyhal"); return; }
      set(key, j.url);
    } catch { setErr("Upload zlyhal"); } finally { setUploading(null); }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => { await saveBranding(fd); setSaved(true); });
  };

  const field = "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm";
  const ImgSlot = ({ url, which, keyName, label }: { url: string | null; which: "logo" | "name"; keyName: "logoUrl" | "nameImageUrl"; label: string }) => (
    <div className="space-y-1.5">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex items-center gap-3">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className={`${which === "logo" ? "h-14 w-14" : "h-10 w-auto max-w-[180px]"} object-contain rounded bg-slate-800 border border-slate-700 p-1`} />
        ) : <div className="h-14 w-14 rounded bg-slate-800 border border-slate-700 grid place-items-center text-slate-600 text-lg">{which === "logo" ? "🏒" : "T"}</div>}
        <label className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold cursor-pointer">
          {uploading === which ? "Nahrávam…" : "Nahrať súbor"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0], keyName, which)} />
        </label>
        {url && <button type="button" onClick={() => set(keyName, "")} className="text-sm text-red-400 hover:text-red-300">Odstrániť</button>}
      </div>
    </div>
  );

  const hasWordmark = !!b.nameImageUrl;
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* hidden inputs carry uploaded URLs + layout into the server action */}
      <input type="hidden" name="logoUrl" value={b.logoUrl ?? ""} />
      <input type="hidden" name="nameImageUrl" value={b.nameImageUrl ?? ""} />
      <input type="hidden" name="logoHeight" value={b.logoHeight} />
      <input type="hidden" name="nameHeight" value={b.nameHeight} />
      <input type="hidden" name="bannerAlign" value={b.bannerAlign} />
      <input type="hidden" name="bannerLayout" value={b.bannerLayout} />
      <input type="hidden" name="logoFirst" value={String(b.logoFirst)} />
      <input type="hidden" name="bannerHeight" value={b.bannerHeight} />
      <input type="hidden" name="socialLinks" value={JSON.stringify(b.socialLinks ?? [])} />

      {/* Templates — pick a look, or save the current one */}
      <div className="rounded-lg border border-slate-800 p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Šablóny vzhľadu</div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {BUILTIN_TEMPLATES.map((t) => (
            <button key={t.key} type="button" onClick={() => applyStyle(t.style)} title={t.desc}
              className="rounded-lg overflow-hidden border border-slate-700 hover:border-blue-500 text-left">
              <div className="h-9 flex items-center px-2 gap-1" style={{ background: t.style.bgColor }}>
                <span className="w-3 h-3 rounded-full" style={{ background: t.style.accentColor }} />
                <span className="w-3 h-3 rounded-full bg-white/70" />
              </div>
              <div className="px-2 py-1 text-[11px] font-semibold text-slate-300">{t.name}</div>
            </button>
          ))}
        </div>
        {savedTemplates.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {savedTemplates.map((t) => (
              <span key={t.id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 pl-2 pr-1 py-1 text-xs">
                <button type="button" onClick={() => applyStyle(t.style)} className="font-semibold text-slate-200 hover:text-white">{t.name}</button>
                <button type="button" onClick={() => delTpl(t.id)} className="text-red-400 hover:text-red-300 leading-none">✕</button>
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="Uložiť aktuálny vzhľad ako šablónu…" className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-sm" />
          <button type="button" onClick={saveTpl} disabled={pending || !tplName.trim()} className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-semibold whitespace-nowrap">Uložiť šablónu</button>
        </div>
      </div>

      {/* Live preview of the banner (mirrors SiteBanner) */}
      <div className="rounded-xl overflow-hidden border border-slate-700">
        <div className={`px-4 flex items-center gap-4 overflow-hidden ${b.bannerHeight > 0 ? "" : "py-4"} ${b.bannerLayout === "stack" ? "flex-col" : "flex-row"} ${b.bannerAlign === "left" ? "justify-start" : b.bannerAlign === "right" ? "justify-end" : "justify-center"}`} style={{ background: b.bgColor, height: b.bannerHeight > 0 ? b.bannerHeight : undefined }}>
          {(b.logoFirst ? ["logo", "name"] : ["name", "logo"]).map((part) => part === "logo" ? (
            b.logoUrl ? <img key="logo" src={b.logoUrl} alt="" className="w-auto object-contain shrink-0 max-h-full" style={{ height: b.logoHeight }} /> : null
          ) : hasWordmark ? (
            <img key="name" src={b.nameImageUrl!} alt="" className="w-auto max-w-[60%] object-contain max-h-full" style={{ height: b.nameHeight }} />
          ) : (
            <div key="name" className="text-center">
              <div className="text-3xl font-black text-white tracking-tight italic leading-none">{b.leagueName || "ProfiNHL"}</div>
              <div className="text-[11px] font-bold tracking-[0.3em] uppercase mt-1" style={{ color: b.accentColor }}>{b.tagline || "…"}</div>
            </div>
          ))}
        </div>
        <div className="px-4 py-2 text-center text-[11px] text-slate-400" style={{ background: b.bgColor }}>
          {b.footerText || `© 2026 ${b.leagueName || "ProfiNHL"}. ${b.tagline}`}
        </div>
      </div>

      {err && <p className="text-sm text-red-400">{err}</p>}

      <div className="grid md:grid-cols-2 gap-5">
        <ImgSlot url={b.logoUrl} which="logo" keyName="logoUrl" label="Logo ligy (znak)" />
        <ImgSlot url={b.nameImageUrl} which="name" keyName="nameImageUrl" label="Názov ako obrázok (wordmark) — nahradí text" />
      </div>

      {/* Banner layout & sizes */}
      <div className="rounded-lg border border-slate-800 p-4 space-y-4">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Veľkosť & umiestnenie v banneri</div>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block"><span className="text-xs text-slate-400">Veľkosť loga — {b.logoHeight}px</span>
            <input type="range" min={24} max={200} value={b.logoHeight} onChange={(e) => setB((p) => ({ ...p, logoHeight: +e.target.value }))} className="w-full accent-blue-500" /></label>
          <label className="block"><span className="text-xs text-slate-400">Veľkosť názvu — {b.nameHeight}px</span>
            <input type="range" min={24} max={200} value={b.nameHeight} onChange={(e) => setB((p) => ({ ...p, nameHeight: +e.target.value }))} className="w-full accent-blue-500" /></label>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <div><span className="text-xs text-slate-400 block mb-1">Zarovnanie</span>
            <div className="flex gap-1">
              {(["left", "center", "right"] as const).map((a) => (
                <button key={a} type="button" onClick={() => setB((p) => ({ ...p, bannerAlign: a }))}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-semibold ${b.bannerAlign === a ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>
                  {a === "left" ? "Vľavo" : a === "center" ? "Stred" : "Vpravo"}</button>
              ))}
            </div></div>
          <div><span className="text-xs text-slate-400 block mb-1">Rozloženie</span>
            <div className="flex gap-1">
              {(["row", "stack"] as const).map((l) => (
                <button key={l} type="button" onClick={() => setB((p) => ({ ...p, bannerLayout: l }))}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-semibold ${b.bannerLayout === l ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>
                  {l === "row" ? "Vedľa seba" : "Pod sebou"}</button>
              ))}
            </div></div>
          <div><span className="text-xs text-slate-400 block mb-1">Poradie</span>
            <div className="flex gap-1">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" onClick={() => setB((p) => ({ ...p, logoFirst: v }))}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-semibold ${b.logoFirst === v ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300"}`}>
                  {v ? "Logo prvé" : "Názov prvý"}</button>
              ))}
            </div></div>
        </div>
        {/* Banner height — independent of logo/name size */}
        <div className="pt-1 border-t border-slate-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-400">Výška banneru {b.bannerHeight > 0 ? `— ${b.bannerHeight}px` : "— automatická (podľa obsahu)"}</span>
            <label className="flex items-center gap-1.5 text-xs text-slate-400"><input type="checkbox" checked={b.bannerHeight === 0} onChange={(e) => setB((p) => ({ ...p, bannerHeight: e.target.checked ? 0 : 96 }))} className="accent-blue-500" />Automatická</label>
          </div>
          {b.bannerHeight > 0 && (
            <input type="range" min={40} max={300} value={b.bannerHeight} onChange={(e) => setB((p) => ({ ...p, bannerHeight: +e.target.value }))} className="w-full accent-blue-500" />
          )}
          <p className="text-[11px] text-slate-500 mt-1">Pri pevnej výške sa banner nezväčšuje keď zväčšíš logo — veľké logo sa oreže na výšku pruhu.</p>
        </div>
      </div>

      {/* Social links in the banner corner */}
      <div className="rounded-lg border border-slate-800 p-4 space-y-3">
        <div className="text-[11px] uppercase tracking-wider text-slate-500">Sociálne siete v banneri</div>
        {(b.socialLinks ?? []).map((s, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select value={s.type} onChange={(e) => setB((p) => ({ ...p, socialLinks: p.socialLinks.map((x, idx) => idx === i ? { ...x, type: e.target.value } : x) }))}
              className="px-2 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm">
              {["facebook", "instagram", "discord", "youtube", "twitter", "forum", "web"].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={s.url} onChange={(e) => setB((p) => ({ ...p, socialLinks: p.socialLinks.map((x, idx) => idx === i ? { ...x, url: e.target.value } : x) }))}
              placeholder="https://…" className={`${field} flex-1`} />
            <button type="button" onClick={() => setB((p) => ({ ...p, socialLinks: p.socialLinks.filter((_, idx) => idx !== i) }))} className="text-red-400 hover:text-red-300 px-1">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setB((p) => ({ ...p, socialLinks: [...(p.socialLinks ?? []), { type: "facebook", url: "" }] }))}
          className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold">+ Pridať odkaz</button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="block"><span className="text-xs text-slate-400">Názov ligy {hasWordmark && <span className="text-slate-600">(použije sa keď nie je wordmark)</span>}</span>
          <input name="leagueName" value={b.leagueName} onChange={(e) => set("leagueName", e.target.value)} className={field} /></label>
        <label className="block"><span className="text-xs text-slate-400">Tagline / podnadpis</span>
          <input name="tagline" value={b.tagline} onChange={(e) => set("tagline", e.target.value)} className={field} /></label>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="block"><span className="text-xs text-slate-400">Akcentná farba</span>
          <div className="flex gap-2 items-center">
            <input type="color" name="accentColor" value={b.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-10 w-14 rounded bg-slate-800 border border-slate-700" />
            <input value={b.accentColor} onChange={(e) => set("accentColor", e.target.value)} className={field} />
          </div></label>
        <label className="block"><span className="text-xs text-slate-400">Farba pozadia</span>
          <div className="flex gap-2 items-center">
            <input type="color" name="bgColor" value={b.bgColor} onChange={(e) => set("bgColor", e.target.value)} className="h-10 w-14 rounded bg-slate-800 border border-slate-700" />
            <input value={b.bgColor} onChange={(e) => set("bgColor", e.target.value)} className={field} />
          </div></label>
      </div>

      <label className="block"><span className="text-xs text-slate-400">Text pätičky (voliteľné — prázdne = automatický copyright)</span>
        <textarea name="footerText" value={b.footerText ?? ""} onChange={(e) => set("footerText", e.target.value)} rows={2} className={field} /></label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold">
          {pending ? "Ukladám…" : "Uložiť branding"}</button>
        {saved && <span className="text-emerald-400 text-sm">✓ Uložené — obnov stránku pre plný efekt</span>}
      </div>
    </form>
  );
}
