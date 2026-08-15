import Link from "next/link";
import { loadSettings } from "@/lib/sim/settings";
import SimSettingsForm from "@/components/SimSettingsForm";
import SimEngineToggle from "@/components/SimEngineToggle";
import { saveSimSettings } from "./actions";
import { PageHeader } from "@/components/ui";
import { activeSimEngine } from "@/lib/sim/version";

export const dynamic = "force-dynamic";

export default async function SimulationAdminPage() {
  const [settings, engine] = await Promise.all([loadSettings(), activeSimEngine()]);
  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="NHL Sim Engine"
        subtitle="Tune how games play out. Multipliers are % of the calibrated baseline (100 = default). Changes apply to the next simulation."
        right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>}
      />
      <SimEngineToggle engine={engine} />
      <SimSettingsForm initial={settings} onSave={saveSimSettings} />
    </div>
  );
}
