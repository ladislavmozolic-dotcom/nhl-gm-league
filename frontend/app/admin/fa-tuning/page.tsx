import { isAdmin, canEditPlayerContracts } from "@/lib/auth";
import { PageHeader, Card, BackPill } from "@/components/ui";
import { loadSettings } from "@/lib/sim/settings";
import FaWeightsForm from "@/components/FaWeightsForm";
import FaPlayerOverride from "@/components/FaPlayerOverride";
import FaTuningAuditLog from "@/components/FaTuningAuditLog";
import FaBulkImportButton from "@/components/FaBulkImportButton";
import MntcRecomputeButton from "@/components/MntcRecomputeButton";
import { recentFaAuditAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function FaTuningAdminPage({ searchParams }: { searchParams: Promise<{ player?: string; name?: string }> }) {
  const [admin, canEdit, sp] = await Promise.all([isAdmin(), canEditPlayerContracts(), searchParams]);
  if (!canEdit) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader title="FA Tuning" subtitle="Free Agency market-weight & override tool" />
        <Card><p className="text-sm text-slate-500">Sign in as a league admin to tune the Free Agency engine.</p></Card>
      </div>
    );
  }

  // a delegated (non-admin) team only gets the player-override tool — the
  // market-weight formula and the full change log stay commissioner-only.
  if (!admin) {
    return (
      <div className="space-y-6 py-2">
        <PageHeader
          title="FA Tuning"
          subtitle="Hand-set a player's asking price. Every change here is logged for the commissioner."
          right={<BackPill href="/admin">Admin</BackPill>}
        />
        <FaPlayerOverride initialQuery={sp.name} />
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

      <FaBulkImportButton />

      <MntcRecomputeButton />

      <FaPlayerOverride initialQuery={sp.name} />

      <FaTuningAuditLog initial={audit} />
    </div>
  );
}
