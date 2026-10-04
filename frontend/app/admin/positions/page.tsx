import { PageHeader, BackPill } from "@/components/ui";
import PositionEditor from "@/components/PositionEditor";
import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPositionsPage() {
  if (!(await isAdmin())) redirect("/"); // commissioner only
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
