import { loadSettings } from "@/lib/sim/settings";
import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { updateSalaryRetentionSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function SalaryRetentionAdminPage() {
  if (!(await isAdmin())) redirect("/");

  const settings = await loadSettings();

  return (
    <div className="max-w-4xl mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">Salary Retention Management</h1>
        <p className="text-sm text-slate-400 mt-1">
          Configure rules for salary retention in trades, including team player limits and total cap percentage limits.
        </p>
      </div>

      <form action={updateSalaryRetentionSettings} className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Max Players IN with Retention
            </label>
            <input
              type="number"
              name="retentionMaxPlayersIn"
              defaultValue={settings.retentionMaxPlayersIn}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              min={0}
              max={10}
            />
            <p className="text-xs text-slate-500 mt-1">Maximum number of retained players a team can acquire.</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Max Players OUT with Retention
            </label>
            <input
              type="number"
              name="retentionMaxPlayersOut"
              defaultValue={settings.retentionMaxPlayersOut}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              min={0}
              max={10}
            />
            <p className="text-xs text-slate-500 mt-1">Maximum number of players a team can retain salary for.</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Max Total Retention % of Cap Hit
            </label>
            <input
              type="number"
              name="retentionMaxTotalPct"
              defaultValue={settings.retentionMaxTotalPct}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              min={1}
              max={100}
              step={0.5}
            />
            <p className="text-xs text-slate-500 mt-1">
              Maximum total active retained salary as a percentage of the team&apos;s Salary Cap (Default: 10%).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Max % Retained on Single Contract
            </label>
            <input
              type="number"
              name="retentionMaxPct"
              defaultValue={settings.retentionMaxPct}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
              min={1}
              max={50}
            />
            <p className="text-xs text-slate-500 mt-1">Maximum percentage of a single player&apos;s salary that can be retained (NHL standard: 50%).</p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-6 py-2.5 rounded-lg text-sm transition-colors"
          >
            Save Retention Rules
          </button>
        </div>
      </form>
    </div>
  );
}
