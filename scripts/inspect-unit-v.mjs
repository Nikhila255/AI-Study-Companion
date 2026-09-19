import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const materials = await prisma.material.findMany({
    where: { fileName: { contains: "InstanceBasedLearning" } },
    select: { id: true, fileName: true, projectId: true },
  });
  console.log("Materials:", materials);

  for (const mat of materials) {
    const chunks = await prisma.documentChunk.findMany({
      where: { documentId: mat.id },
      select: { id: true, pageNumber: true, content: true },
      orderBy: { pageNumber: "asc" },
    });
    console.log(`\n=== Material: ${mat.fileName} (${mat.id}, Total chunks: ${chunks.length}) ===`);
    for (const c of chunks) {
      if (c.content.toLowerCase().includes("decision")) {
        console.log(`\n--- Page ${c.pageNumber} (Chunk ${c.id}) ---`);
        console.log(c.content);
      }
    }
  }
}

main().finally(() => prisma.$disconnect());
