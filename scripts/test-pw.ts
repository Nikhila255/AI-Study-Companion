import { prisma } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const u = await prisma.user.findUnique({ where: { email: "nikhilamadem9@gmail.com" } });
  if (!u) return;
  const candidates = [
    "Password123!", "pass123", "Pass123!", "12345678", "nikhila", "Nikhila", "Nikhila123", "Nikhila@123",
    "nikhila123", "nikhila@123", "admin123", "studycompanion", "ai-study-companion", "Study123!"
  ];
  for (const c of candidates) {
    if (await bcrypt.compare(c, u.passwordHash)) {
      console.log("MATCH FOUND:", c);
      return;
    }
  }
  console.log("No match among candidates");
}

main().catch(console.error).finally(() => prisma.$disconnect());
