import { PageHeader, BackPill } from "@/components/ui";
import ProfileEditor from "@/components/ProfileEditor";

export const dynamic = "force-dynamic";

export default function AdminProfilePage() {
  return (
    <div className="space-y-6 py-2">
      <PageHeader
        title="Player Profile"
        subtitle="Search a player and edit his bio — date of birth, birthplace, nationality, height, weight, jersey number, shoots/catches."
        right={<BackPill href="/admin">Admin</BackPill>}
      />
      <ProfileEditor />
    </div>
  );
}
