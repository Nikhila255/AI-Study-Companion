import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const materialId = "78914ec5-c6cc-4e01-b1ec-5a1b13b718cb";
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: materialId },
    orderBy: { chunkIndex: "asc" },
  });
  console.log(`=== Total Chunks: ${chunks.length} ===`);
  for (const c of chunks) {
    console.log(`\n--- CHUNK ${c.chunkIndex} (Page ${c.pageNumber}) ---`);
    console.log(c.content);
  }
}

main().finally(() => prisma.$disconnect());
