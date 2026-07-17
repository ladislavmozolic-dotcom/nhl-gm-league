import { PrismaClient } from "@prisma/client";

export default function TestPage() {
  const prisma = new PrismaClient();

  return <pre>{String("player" in prisma)}</pre>;
}