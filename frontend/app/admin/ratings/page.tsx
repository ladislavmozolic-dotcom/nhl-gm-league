import { PageHeader, BackPill } from "@/components/ui";
import RatingsEditor from "@/components/RatingsEditor";
import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminRatingsPage() {
  if (!(await isAdmin())) redirect("/"); // commissioner only
  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Player Ratings"
        subtitle="Search a player and tune his ratings — the sim reflects these directly."
        right={<BackPill href="/admin">Admin</BackPill>}
      />
      <RatingsEditor />
    </div>
  );
}
