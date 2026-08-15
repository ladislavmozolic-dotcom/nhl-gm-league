import Link from "next/link";
import { PageHeader } from "@/components/ui";
import RatingsEditor from "@/components/RatingsEditor";

export const dynamic = "force-dynamic";

export default function AdminRatingsPage() {
  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Player Ratings"
        subtitle="Search a player and tune his ratings — the sim reflects these directly."
        right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>}
      />
      <RatingsEditor />
    </div>
  );
}
