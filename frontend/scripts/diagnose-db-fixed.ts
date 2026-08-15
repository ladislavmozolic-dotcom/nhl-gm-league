import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function diagnose() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  🏒 NHL-GM-League DB DIAGNOSTICS");
  console.log("═══════════════════════════════════════════════════\n");

  const teams = await prisma.team.findMany({ 
    orderBy: { id: "asc" },
    select: { id: true, name: true, slug: true, code: true, logoUrl: true, conference: true, division: true, isAffiliate: true }
  });
  console.log(`📊 TÍMY: ${teams.length}`);
  const nhl = teams.filter(t => !t.isAffiliate);
  const ahl = teams.filter(t => t.isAffiliate);
  console.log(`   NHL: ${nhl.length} | AHL: ${ahl.length}\n`);
  nhl.forEach(t => console.log(`   ${t.id}. ${t.name} (${t.code ?? "—"})`));

  const totalPlayers = await prisma.player.count();
  console.log(`\n👥 HRÁČI: ${totalPlayers}`);
  
  const latest = await prisma.player.findMany({
    orderBy: { id: "desc" }, take: 5,
    include: { team: { select: { name: true, code: true } } },
  });
  latest.forEach(p => console.log(`   #${p.id} ${p.name} | ${p.team?.code ?? "—"}`));

  console.log("\n📋 PLAYER STĹPCE:");
  const cols = await prisma.$queryRaw`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'Player' 
    ORDER BY ordinal_position
  `;
  (cols as any[]).forEach((c: any) => console.log(`   ${c.column_name}: ${c.data_type}`));

  const expected = ["photoUrl","age","position","contractText","capHit","isUfa","isRfa","hasNtc","isCaptain","isAssistant","isRookie","status","ov"];
  const names = (cols as any[]).map(c => c.column_name);
  const missing = expected.filter(e => !names.includes(e));
  console.log(`\n⚠️  CHÝBA: ${missing.length > 0 ? missing.join(", ") : "nič ✅"}`);

  console.log(`\n🎯 DRAFT PICKS: ${await prisma.draftPick.count()}`);
  const games = await prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*) AS count FROM "Game"`;
  console.log(`🏒 GAMES: ${games[0]?.count ?? 0}`);
  console.log(`📝 TRANSACTIONS: ${await prisma.transaction.count()}`);
  const champions = await prisma.$queryRaw<{ count: number }[]>`SELECT COUNT(*) AS count FROM "Champion"`;
  console.log(`🏆 CHAMPIONS: ${champions[0]?.count ?? 0}`);
  console.log(`⭐ PROSPECTS: ${await prisma.prospect.count()}`);

  console.log("\n═══════════════════════════════════════════════════");
  await prisma.$disconnect();
}

diagnose().catch(e => { console.error("❌", e.message); process.exit(1); });
