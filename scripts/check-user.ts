import { prisma } from "../src/lib/db";

async function main() {
  const p = await prisma.project.findUnique({
    where: { id: "3f719e4e-2547-493a-953d-23537ec140ba" },
    include: {
      user: { select: { id: true, email: true, fullName: true } },
      space: { select: { id: true, name: true } },
    },
  });
  console.log("Project Details:", p);
}

main().catch(console.error).finally(() => prisma.$disconnect());
