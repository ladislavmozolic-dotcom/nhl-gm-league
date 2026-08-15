import { scheduleTemplateCsv } from "@/lib/sim/csv-schedule";

export async function GET() {
  return new Response(scheduleTemplateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="schedule-template.csv"',
    },
  });
}
