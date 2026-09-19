import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: '82b21146-d78f-4ba0-8237-9715c6f6d4c4' },
    select: { id: true, pageNumber: true, chunkIndex: true, content: true }
  });
  console.log('Total chunks:', chunks.length);
  for (let i = 0; i < 5; i++) {
    console.log(`Chunk ${i} length ${chunks[i].content.length}:`);
    console.log(chunks[i].content);
    console.log('---');
  }
}

main().finally(() => prisma.$disconnect());
