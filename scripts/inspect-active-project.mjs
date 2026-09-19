import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const projectId = "3f719e4e-2547-493a-953d-23537ec140ba";
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      materials: true,
      concepts: true,
    },
  });

  console.log("Project name:", project?.name);
  console.log("Materials:", project?.materials.map(m => ({ id: m.id, fileName: m.fileName, status: m.status })));
  console.log("Concepts:", project?.concepts.map(c => ({ id: c.id, name: c.name, score: c.importanceScore })));
  
  const iblMaterial = project?.materials.find(m => m.fileName.includes("InstanceBasedLearning"));
  console.log("IBL Material ID:", iblMaterial?.id);

  if (iblMaterial) {
    const chunks = await prisma.documentChunk.findMany({
      where: { projectId, documentId: iblMaterial.id },
      select: { pageNumber: true, chunkIndex: true, content: true },
      orderBy: { chunkIndex: "asc" },
    });
    console.log(`IBL Chunks count: ${chunks.length}`);
    for (const c of chunks.slice(0, 3)) {
      console.log(`\n--- Page ${c.pageNumber} Chunk ${c.chunkIndex} ---`);
      console.log(c.content.slice(0, 300));
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
