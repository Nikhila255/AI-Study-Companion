import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash("Pass123!", 10);
  await prisma.user.update({
    where: { email: "tester_1789648523194@studycompanion.dev" },
    data: { passwordHash: hash }
  });
  console.log("PASSWORD_UPDATED_TO_Pass123!");
}
main().finally(() => prisma.$disconnect());
