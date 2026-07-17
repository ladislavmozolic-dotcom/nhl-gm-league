"use server";

import { PrismaClient } from "@prisma/client";
import { redirect } from "next/navigation";

const prisma = new PrismaClient();

export async function updateContract(formData: FormData) {
  const slug = formData.get("slug") as string;

  const capHit = Number(formData.get("capHit"));
  const contractYears = Number(
    formData.get("contractYears")
  );
  const contractExpiry = Number(
    formData.get("contractExpiry")
  );

  await prisma.player.update({
    where: {
      slug,
    },
    data: {
      capHit,
      contractYears,
      contractExpiry,
    },
  });

  redirect(`/admin/contracts/${slug}`);
}