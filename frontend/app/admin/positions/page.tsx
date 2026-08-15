import Link from "next/link";
import { PageHeader } from "@/components/ui";
import PositionEditor from "@/components/PositionEditor";

export const dynamic = "force-dynamic";

export default function AdminPositionsPage() {
  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Player Positions"
        subtitle="Search a player and add or remove positions (and shooting side)."
        right={<Link href="/admin" className="text-sm text-slate-400 hover:text-blue-400">← Admin</Link>}
      />
      <PositionEditor />
    </div>
  );
}
