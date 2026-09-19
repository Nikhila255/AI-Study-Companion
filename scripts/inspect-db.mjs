import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({
    include: {
      concepts: true,
      materials: {
        select: { id: true, fileName: true, status: true, totalPages: true },
      },
      masteryRecords: {
        include: { concept: true },
      },
      assessments: {
        select: { id: true, title: true, status: true, questions: { select: { id: true, questionText: true, conceptId: true } } },
      },
    },
  });

  console.log("PROJECTS SUMMARY:");
  for (const p of projects) {
    console.log(`\nProject: ${p.name} (ID: ${p.id})`);
    console.log("Materials:", p.materials);
    console.log("Concepts:", p.concepts.map(c => ({ id: c.id, name: c.name, score: c.importanceScore })));
    console.log("Mastery Records:", p.masteryRecords.map(m => ({ concept: m.concept?.name, score: m.masteryScore, status: m.growthStatus })));
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
