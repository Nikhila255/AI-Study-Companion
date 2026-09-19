import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const c = await prisma.documentChunk.findFirst({
    where: { documentId: '82b21146-d78f-4ba0-8237-9715c6f6d4c4', chunkIndex: 3 }
  });
  console.log('Chunk 3 content:', JSON.stringify(c?.content));
}

main().finally(() => prisma.$disconnect());
