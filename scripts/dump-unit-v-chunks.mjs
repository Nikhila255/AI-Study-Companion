import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const mat = await prisma.material.findFirst({
    where: { fileName: { contains: "InstanceBasedLearning" }, status: "READY" }
  });
  console.log("Material:", mat.id, mat.fileName);
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: mat.id },
    orderBy: { chunkIndex: "asc" }
  });
  console.log("Total chunks:", chunks.length);
  for (const c of chunks) {
    console.log(`\n================== Chunk #${c.chunkIndex} (Page ${c.pageNumber}) ==================`);
    console.log(c.content);
  }
}

main().finally(() => prisma.$disconnect());
