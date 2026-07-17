import { prisma } from "../../lib/prisma";

export default async function TeamsPage() {
  console.log(Object.keys(prisma));

  return (
    <main>
      <h1>Teams</h1>
    </main>
  );
}