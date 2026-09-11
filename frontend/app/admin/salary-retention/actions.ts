import { loadSettings, saveSettings } from "@/lib/sim/settings";
import { isAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateSalaryRetentionSettings(formData: FormData) {
  if (!(await isAdmin())) throw new Error("Unauthorized");

  const retentionMaxPlayersIn = Number(formData.get("retentionMaxPlayersIn") ?? 3);
  const retentionMaxPlayersOut = Number(formData.get("retentionMaxPlayersOut") ?? 3);
  const retentionMaxTotalPct = Number(formData.get("retentionMaxTotalPct") ?? 10);
  const retentionMaxPct = Number(formData.get("retentionMaxPct") ?? 50);

  const settings = await loadSettings();
  settings.retentionMaxPlayersIn = retentionMaxPlayersIn;
  settings.retentionMaxPlayersOut = retentionMaxPlayersOut;
  settings.retentionMaxTotalPct = retentionMaxTotalPct;
  settings.retentionMaxPct = retentionMaxPct;

  await saveSettings(settings);
  revalidatePath("/admin/salary-retention");
  revalidatePath("/admin");
}
