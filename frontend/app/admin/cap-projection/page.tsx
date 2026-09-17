import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadSettings } from "@/lib/sim/settings";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { CapProjectionEditor } from "./CapProjectionEditor";

export const dynamic = "force-dynamic";

export default async function CapProjectionPage() {
  if (!(await isAdmin())) redirect("/login");

  const [rows, settings] = await Promise.all([
    prisma.capProjection.findMany({ orderBy: { year: "asc" } }),
    loadSettings(),
  ]);

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Cap Limit Projections"
        subtitle="Set the projected salary cap ceiling and floor for each future season. Shown in the Cap Projection table on every team's Salary Cap page."
        right={<BackPill href="/admin">Admin</BackPill>}
      />

      <Card title="NHL Real Data Reference" accent="text-sky-400" bodyClassName="p-4">
        <p className="text-xs text-slate-400 mb-3">
          Official NHL/NHLPA figures for reference. Your league uses its own cap values (set in{" "}
          <a href="/league/parameters" className="text-blue-400 hover:underline">League Parameters</a>), but you can
          scale these or enter your own projections below.
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-slate-800">
              <th className="text-left py-1.5 pr-4">Season</th>
              <th className="text-right py-1.5 pr-4">Upper Limit</th>
              <th className="text-right py-1.5 pr-4">Lower Limit</th>
              <th className="text-left py-1.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/40">
            {[
              { s: "2026-27", upper: "$104 000 000", lower: "$76 900 000", status: "✅ Confirmed" },
              { s: "2027-28", upper: "$113 500 000", lower: "$83 900 000", status: "✅ Confirmed" },
              { s: "2028-29", upper: "~$123 000 000", lower: "~$91 000 000", status: "📊 Estimated" },
              { s: "2029-30", upper: "~$132 500 000", lower: "~$98 000 000", status: "📊 Estimated" },
              { s: "2030-31", upper: "~$142 000 000", lower: "~$105 000 000", status: "📊 Estimated" },
            ].map((r) => (
              <tr key={r.s} className="text-slate-300">
                <td className="py-1.5 pr-4 font-medium">{r.s}</td>
                <td className="py-1.5 pr-4 text-right tabular-nums text-emerald-400">{r.upper}</td>
                <td className="py-1.5 pr-4 text-right tabular-nums text-slate-400">{r.lower}</td>
                <td className="py-1.5 text-slate-500">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-slate-600 mt-2">Sources: NHL.com, NHLPA announcement. Estimates assume ~$9.5M annual growth beyond 2027-28.</p>
      </Card>

      <Card title="Your League Cap Projections" accent="text-blue-400" bodyClassName="p-4">
        <p className="text-xs text-slate-400 mb-4">
          Currently active cap: <span className="text-slate-200 font-semibold">${(settings.salaryCapUpper / 1_000_000).toFixed(1)}M</span> upper /{" "}
          <span className="text-slate-400">${(settings.salaryCapLower / 1_000_000).toFixed(1)}M</span> lower (from League Parameters — used as fallback for any season without a custom projection below).
        </p>
        <CapProjectionEditor
          rows={rows}
          currentUpper={settings.salaryCapUpper}
          currentLower={settings.salaryCapLower}
        />
      </Card>
    </div>
  );
}
