import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const chunks = await prisma.documentChunk.findMany({
    where: { projectId: "3f719e4e-2547-493a-953d-23537ec140ba" },
    orderBy: [{ pageNumber: "asc" }, { chunkIndex: "asc" }],
  });

  console.log(`Total chunks: ${chunks.length}`);
  for (const c of chunks) {
    console.log(`--- Page ${c.pageNumber}, Chunk ${c.chunkIndex}, ID: ${c.id} ---`);
    console.log(c.content);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
