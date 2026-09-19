"use client";

import { useState, useTransition } from "react";
import type { CreateExpansionTeamInput } from "@/app/admin/expansion/new/actions";

export default function ExpansionTeamForm({ action }: { action: (input: CreateExpansionTeamInput) => Promise<{ ok: boolean; error?: string } | void> }) {
  const [f, setF] = useState<CreateExpansionTeamInput>({
    name: "", arena: "", conference: "", division: "", capacity: "", logoUrl: "", code: "", startingCapital: "",
  });
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const set = (k: keyof CreateExpansionTeamInput, v: string) => setF((p) => ({ ...p, [k]: v }));

  const upload = async (file: File | undefined) => {
    setErr(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) { setErr("Musí to byť obrázok."); return; }
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/expansion-upload", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) { setErr(j.error || "Upload zlyhal"); return; }
      set("logoUrl", j.url);
    } catch { setErr("Upload zlyhal"); } finally { setUploading(false); }
  };

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErr(null);
    if (!f.name.trim()) { setErr("Zadaj názov tímu."); return; }
    start(async () => {
      const res = await action(f);
      if (res && !res.ok) setErr(res.error || "Nepodarilo sa vytvoriť tím.");
    });
  };

  const field = "w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        {f.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.logoUrl} alt="" className="h-16 w-16 object-contain rounded bg-slate-800 border border-slate-700 p-1" />
        ) : (
          <div className="h-16 w-16 rounded bg-slate-800 border border-slate-700 grid place-items-center text-slate-600 text-xl">🏒</div>
        )}
        <label className="px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-semibold cursor-pointer">
          {uploading ? "Nahrávam…" : "Nahrať logo"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        </label>
        {f.logoUrl && <button type="button" onClick={() => set("logoUrl", "")} className="text-sm text-red-400 hover:text-red-300">Odstrániť</button>}
      </div>

      <label className="block"><span className="text-xs text-slate-400">Názov tímu (napr. SEATTLE KRAKEN)</span>
        <input value={f.name} onChange={(e) => set("name", e.target.value)} className={field} placeholder="Team name" /></label>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="block"><span className="text-xs text-slate-400">Aréna</span>
          <input value={f.arena} onChange={(e) => set("arena", e.target.value)} className={field} placeholder="Climate Pledge Arena" /></label>
        <label className="block"><span className="text-xs text-slate-400">Kapacita (voliteľné)</span>
          <input value={f.capacity} onChange={(e) => set("capacity", e.target.value.replace(/[^0-9]/g, ""))} className={field} placeholder="17151" /></label>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="block"><span className="text-xs text-slate-400">Konferencia</span>
          <input value={f.conference} onChange={(e) => set("conference", e.target.value)} className={field} placeholder="Western" /></label>
        <label className="block"><span className="text-xs text-slate-400">Divízia</span>
          <input value={f.division} onChange={(e) => set("division", e.target.value)} className={field} placeholder="Pacific" /></label>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <label className="block"><span className="text-xs text-slate-400">Skratka (2-4 písmená, voliteľné — inak sa odvodí)</span>
          <input value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase().slice(0, 4))} className={field} placeholder="SEA" /></label>
        <label className="block"><span className="text-xs text-slate-400">Počiatočný bankový účet (voliteľné — inak default ligy)</span>
          <input value={f.startingCapital} onChange={(e) => set("startingCapital", e.target.value.replace(/[^0-9]/g, ""))} className={field} placeholder="40000000" /></label>
      </div>

      {err && <p className="text-sm text-red-400">{err}</p>}

      <p className="text-[11px] text-slate-500">Vytvorí sa aj AHL farm klub a náhradný tréner — obidva môžeš neskôr premenovať/upraviť ako pri každom inom tíme. Tím nemá GM, kým si niekto nepodá žiadosť o vstup.</p>

      <button type="submit" disabled={pending} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold">
        {pending ? "Vytváram…" : "Vytvoriť expanzný tím"}
      </button>
    </form>
  );
}
