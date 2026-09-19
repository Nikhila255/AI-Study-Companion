import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const projectId = "3f719e4e-2547-493a-953d-23537ec140ba";
  const materialId = "78914ec5-c6cc-4e01-b1ec-5a1b13b718cb"; // Unit-V_InstanceBasedLearning.pdf

  // Fetch chunks
  const chunks = await prisma.documentChunk.findMany({
    where: { projectId, documentId: materialId },
    select: { content: true },
  });
  console.log("Found chunks:", chunks.length);
  const fullText = chunks.map(c => c.content).join("\n\n").toLowerCase();

  // Find project concepts
  const allConcepts = await prisma.concept.findMany({
    where: { projectId },
  });

  const matching = allConcepts.filter(c => fullText.includes(c.name.toLowerCase()));
  console.log("Matching concepts from DB:", matching.map(m => m.name));
}

main().finally(() => prisma.$disconnect());
