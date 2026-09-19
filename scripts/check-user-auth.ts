import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const users = await prisma.user.findMany();
  for (const u of users) {
    const isPass = await bcrypt.compare("Pass123!", u.passwordHash);
    const isSecure = await bcrypt.compare("SecurePassword123!", u.passwordHash);
    const isLearner = await bcrypt.compare("LearnerPass123!", u.passwordHash);
    console.log(`User: ${u.email} (id: ${u.id}) -> Pass123!: ${isPass}, SecurePassword123!: ${isSecure}, LearnerPass123!: ${isLearner}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
