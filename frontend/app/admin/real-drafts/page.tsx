import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { isAdmin } from "@/lib/auth";
import { importedRealDraftYears } from "@/lib/real-draft-import";
import PreviewClassImport from "@/components/PreviewClassImport";
import { currentDraftYear } from "@/lib/draft-class-import";
import RealDraftManager from "@/components/RealDraftManager";

export const dynamic = "force-dynamic";

export default async function AdminRealDraftsPage() {
  if (!(await isAdmin())) redirect("/");
  const imported = await importedRealDraftYears();
  const year = await currentDraftYear();
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Real Draft Import" subtitle="Load real NHL Entry Drafts into real-roster Draft History. Stored durably in the database — safe across restarts." />
      <PreviewClassImport year={year} />
      <RealDraftManager imported={imported} />
    </div>
  );
}
