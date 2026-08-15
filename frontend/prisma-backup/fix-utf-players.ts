import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const fixes: Record<string, string> = {
  "Alex Barr∩┐╜-Boulet": "Alex Barré-Boulet",
  "Andr∩┐╜ Burakovsky": "André Burakovsky",
  "David Ji?∩┐╜?ek": "David Jiříček",
  "David Pastr?∩┐╜k": "David Pastrňák",
  "Erik ?ern∩┐╜k": "Erik Černák",
  "Ji?∩┐╜ Patera": "Jiří Patera",
  "Luk∩┐╜? Dost∩┐╜l": "Lukáš Dostál",
  "Nicolas Aub∩┐╜-Kubel": "Nicolas Aubé-Kubel",
  "Nils ∩┐╜man": "Nils Åman",
  "Olli M∩┐╜∩┐╜tt∩┐╜": "Olli Määttä",
  "Tom∩┐╜? Hertl": "Tomáš Hertl",
  "Tom∩┐╜? Nosek": "Tomáš Nosek",
  "V∩┐╜tek Van??ek": "Vítek Vaněček",
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  let updated = 0;

  for (const [bad, good] of Object.entries(fixes)) {
    const player = await prisma.player.findFirst({
      where: { name: bad },
    });

    if (!player) continue;

    await prisma.player.update({
      where: { id: player.id },
      data: {
        name: good,
        slug: slugify(good),
      },
    });

    updated++;

    console.log(`${bad} -> ${good}`);
  }

  console.log({ updated });
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });