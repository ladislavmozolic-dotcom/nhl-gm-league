import { PageHeader, BackPill } from "@/components/ui";
import PositionEditor from "@/components/PositionEditor";

export const dynamic = "force-dynamic";

export default function AdminPositionsPage() {
  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Player Positions"
        subtitle="Search a player and add or remove positions (and shooting side)."
        right={<BackPill href="/admin">Admin</BackPill>}
      />
      <PositionEditor />
    </div>
  );
}
