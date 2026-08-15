import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import CalibrationLab from "@/components/CalibrationLab";

export const dynamic = "force-dynamic";

export default async function CalibrationPage() {
  if (!(await isAdmin())) redirect("/");
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="Calibration Lab" subtitle="Sim a full in-memory season and grade every engine metric against its NHL target." />
      <CalibrationLab />
    </div>
  );
}
