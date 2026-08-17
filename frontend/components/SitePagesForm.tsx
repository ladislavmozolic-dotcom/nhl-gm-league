"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPage, updatePage, deletePage } from "@/app/admin/site-editor/actions";

export type PageRow = { id: number; slug: string; title: string; body: string; published: boolean; inMenu: boolean; menuLabel: string | null; order: number };

export default function SitePagesForm({ pages }: { pages: PageRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<PageRow | null>(null);
  const [pending, start] = useTransition();
  const [newTitle, setNewTitle] = useState("");

  const create = () => start(async () => {
    const id = await createPage(newTitle);
    setNewTitle("");
    router.refresh();
    // open the freshly created page for editing (optimistic minimal row)
    setEditing({ id, slug: "", title: newTitle || "Nová stránka", body: "", published: false, inMenu: false, menuLabel: null, order: 0 });
  });

  const save = () => { if (!editing) return; start(async () => { await updatePage(editing.id, { ...editing, menuLabel: editing.menuLabel ?? "" }); router.refresh(); }); };
  const remove = (id: number) => { if (!confirm("Zmazať túto stránku?")) return; start(async () => { await deletePage(id); setEditing(null); router.refresh(); }); };

  const field = "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm";

  if (editing) {
    const e = editing;
    const set = <K extends keyof PageRow>(k: K, v: PageRow[K]) => setEditing({ ...e, [k]: v });
    return (
      <div className="space-y-4">
        <button onClick={() => setEditing(null)} className="text-sm text-slate-400 hover:text-white">← Späť na zoznam</button>
        <label className="block"><span className="text-xs text-slate-400">Názov</span>
          <input value={e.title} onChange={(ev) => set("title", ev.target.value)} className={field} /></label>
        <label className="block"><span className="text-xs text-slate-400">Obsah (Markdown — # nadpis, **tučné**, - zoznam, [text](url))</span>
          <textarea value={e.body} onChange={(ev) => set("body", ev.target.value)} rows={14} className={`${field} font-mono text-[13px]`} /></label>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={e.published} onChange={(ev) => set("published", ev.target.checked)} className="accent-blue-500" /> Publikované (viditeľné pre všetkých)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={e.inMenu} onChange={(ev) => set("inMenu", ev.target.checked)} className="accent-blue-500" /> Zobraziť v hornom menu</label>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block"><span className="text-xs text-slate-400">Popisok v menu (voliteľné)</span>
            <input value={e.menuLabel ?? ""} onChange={(ev) => set("menuLabel", ev.target.value)} placeholder={e.title} className={field} /></label>
          <label className="block"><span className="text-xs text-slate-400">Poradie v menu</span>
            <input type="number" value={e.order} onChange={(ev) => set("order", +ev.target.value)} className={field} /></label>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={pending} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold">{pending ? "Ukladám…" : "Uložiť stránku"}</button>
          {e.slug && <a href={`/p/${e.slug}`} target="_blank" className="text-sm text-slate-400 hover:text-white">Zobraziť →</a>}
          <button onClick={() => remove(e.id)} disabled={pending} className="ml-auto text-sm text-red-400 hover:text-red-300">Zmazať</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Názov novej stránky (napr. Pravidlá)" className={field} />
        <button onClick={create} disabled={pending} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold whitespace-nowrap">+ Vytvoriť</button>
      </div>
      {pages.length === 0 ? (
        <p className="text-sm text-slate-500">Zatiaľ žiadne vlastné stránky. Vytvor prvú (napr. Pravidlá, O lige, Novinky).</p>
      ) : (
        <div className="rounded-lg border border-slate-800 divide-y divide-slate-800/70">
          {pages.map((p) => (
            <button key={p.id} onClick={() => setEditing(p)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/40 text-left">
              <span className="flex-1 text-sm font-medium text-slate-200">{p.title} <span className="text-slate-600">/p/{p.slug}</span></span>
              {p.published ? <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 uppercase">Publikované</span> : <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-400 uppercase">Koncept</span>}
              {p.inMenu && <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 uppercase">V menu</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
