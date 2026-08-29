import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createPlayer } from "../actions";
import { PageHeader, Card } from "@/components/ui";
import { isComishOrCoComish } from "@/lib/auth";
import { SKATER_FIELDS } from "@/lib/skater-fields";

export const dynamic = "force-dynamic";

const LABEL: Record<string, string> = {
  overall: "OV", ck: "CK", fg: "FG", di: "DI", sk: "SK", st: "ST", en: "EN", du: "DU",
  ph: "PH", fo: "FO", pa: "PA", sc: "SC", df: "DF", ps: "PS", ex: "EX", ld: "LD", mo: "MO",
};

export default async function NewPlayerPage() {
  const [teams, canOverride] = await Promise.all([
    prisma.team.findMany({ select: { id: true, name: true, league: true }, orderBy: [{ league: "asc" }, { name: "asc" }] }),
    isComishOrCoComish(),
  ]);

  const inputCls = "w-full bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500";
  const labelCls = "block text-xs uppercase tracking-wide text-slate-400 mb-1";

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Add Player"
        subtitle="Create a player from scratch — bio, contract and ratings entered by hand."
        right={<Link href="/admin/contracts" className="text-sm text-slate-400 hover:text-blue-400">← Contracts</Link>}
      />

      {!canOverride ? (
        <div className="text-sm text-amber-300 bg-amber-950/30 border border-amber-800/50 rounded-lg px-4 py-2.5">
          Only the Comish or Co-Comish can add a player.
        </div>
      ) : (
        <form action={createPlayer} className="space-y-6">
          <Card title="Bio">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div><label className={labelCls}>Name *</label><input name="name" required className={inputCls} placeholder="Connor McDavid" /></div>
              <div>
                <label className={labelCls}>Team *</label>
                <select name="teamId" required className={inputCls}>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.league})</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Position * (e.g. C, LW/RW, D)</label><input name="position" required className={inputCls} placeholder="C" /></div>
              <div className="flex items-center gap-2 pt-6"><input type="checkbox" id="isGoalie" name="isGoalie" className="w-4 h-4" /><label htmlFor="isGoalie" className="text-sm">Goalie</label></div>
              <div>
                <label className={labelCls}>Roster status</label>
                <select name="rosterType" defaultValue="NHL" className={inputCls}>
                  <option value="NHL">NHL</option>
                  <option value="AHL">AHL</option>
                  <option value="PROSPECT">Reserve / Prospect Pool</option>
                  <option value="UFA">UFA (free agent)</option>
                </select>
              </div>
              <div><label className={labelCls}>Jersey number</label><input type="number" name="number" min="0" max="99" className={inputCls} /></div>
              <div><label className={labelCls}>Nationality (3-letter code)</label><input name="nationality" maxLength={3} className={inputCls} placeholder="CAN" /></div>
              <div>
                <label className={labelCls}>Shoots / Catches</label>
                <select name="shoots" className={inputCls}><option value="">—</option><option value="L">L</option><option value="R">R</option></select>
              </div>
              <div><label className={labelCls}>Birth date</label><input type="date" name="birthDate" className={inputCls} /></div>
              <div><label className={labelCls}>Height (cm)</label><input type="number" name="heightCm" min="150" max="220" className={inputCls} placeholder="185" /></div>
              <div><label className={labelCls}>Weight (kg)</label><input type="number" name="weightKg" min="50" max="150" className={inputCls} placeholder="90" /></div>
            </div>
          </Card>

          <Card title="Contract">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><label className={labelCls}>Cap Hit ($, 50k steps)</label><input type="number" name="capHit" step="50000" min="0" className={inputCls} placeholder="4050000" /></div>
              <div><label className={labelCls}>Contract Length (years)</label><input type="number" name="contractYears" min="0" max="8" className={inputCls} /></div>
              <div>
                <label className={labelCls}>Contract Type</label>
                <select name="contractType" className={inputCls}><option value="">—</option><option value="ONE_WAY">One-way</option><option value="TWO_WAY">Two-way</option></select>
              </div>
            </div>
          </Card>

          <Card title="Ratings (skaters only — leave blank for 50)">
            <div className="flex flex-wrap gap-3">
              {SKATER_FIELDS.map((f) => (
                <label key={f} className="flex flex-col items-center">
                  <span className={`text-[10px] font-bold uppercase ${f === "overall" ? "text-blue-400" : "text-slate-500"}`}>{LABEL[f]}</span>
                  <input type="number" name={f} min={20} max={99} defaultValue={50}
                    className={`w-12 text-center tabular-nums bg-slate-900 border rounded px-1 py-1 text-sm ${f === "overall" ? "border-blue-700 font-bold" : "border-slate-700"}`} />
                </label>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-3">Ignored if Goalie is checked above — goalie ratings aren't editable here yet.</p>
          </Card>

          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold">Create Player</button>
        </form>
      )}
    </div>
  );
}
