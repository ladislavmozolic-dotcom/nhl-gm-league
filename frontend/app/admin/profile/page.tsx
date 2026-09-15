import { isAdmin } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PageHeader, BackPill } from "@/components/ui";
import ProfileEditor from "@/components/ProfileEditor";

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  if (!(await isAdmin())) redirect("/login");
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
