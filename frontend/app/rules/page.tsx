import { PageHeader, Card } from "@/components/ui";

const SECTIONS = [
  { title: "1. Roster Requirements", points: [
    "Minimum 20 players on active roster",
    "Maximum 23 players on active roster",
    "2 goalies required",
    "Salary cap must be respected at all times",
  ] },
  { title: "2. Trades", points: [
    "All trades must be approved by league commissioners",
    "Salary retention up to 50% is allowed",
    "Future draft picks can be traded up to 3 years ahead",
    "NMC/NTC clauses must be respected",
  ] },
  { title: "3. Waivers", points: [
    "Players on entry-level contracts are waiver exempt",
    "Waiver priority is based on reverse standings",
    "Claim period lasts 24 hours",
  ] },
  { title: "4. Free Agency", points: [
    "UFAs can sign with any team",
    "RFAs must be tendered qualifying offers",
    "Offer sheets are allowed with appropriate compensation",
  ] },
  { title: "5. Draft", points: [
    "7 rounds, snake draft format",
    "Draft order based on previous season standings",
    "Lottery for top 3 picks",
  ] },
];

export default function RulesPage() {
  return (
    <div className="space-y-6 py-2">
      <PageHeader title="League Rules" subtitle="Official rules and guidelines for the NHL GM League" />

      <div className="space-y-6">
        {SECTIONS.map((s) => (
          <Card key={s.title} title={s.title} accent="text-blue-400">
            <ul className="space-y-2 text-slate-300 text-sm list-disc list-inside">
              {s.points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
