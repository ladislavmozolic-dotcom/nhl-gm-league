import { isAdmin } from "@/lib/auth";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { loadSettings } from "@/lib/sim/settings";
import FaWeightsForm from "@/components/FaWeightsForm";
import FaPlayerOverride from "@/components/FaPlayerOverride";
import FaTuningAuditLog from "@/components/FaTuningAuditLog";
import { recentFaAuditAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function FaTuningAdminPage() {
  const admin = await isAdmin();
  if (!admin) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader title="FA Tuning" subtitle="Free Agency market-weight & override tool" />
        <Card><p className="text-sm text-slate-500">Sign in as a league admin to tune the Free Agency engine.</p></Card>
      </div>
    );
  }
  const [settings, audit] = await Promise.all([loadSettings(), recentFaAuditAction()]);

  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="FA Tuning"
        subtitle="How the demand engine values F/D/G ratings, plus per-player demand overrides. Every change here is logged below."
        right={<BackPill href="/admin">Admin</BackPill>}
      />

      <FaWeightsForm initial={{ f: settings.faWeightF, d: settings.faWeightD, g: settings.faWeightG }} />

      <FaPlayerOverride />

      <FaTuningAuditLog initial={audit} />
    </div>
  );
}
