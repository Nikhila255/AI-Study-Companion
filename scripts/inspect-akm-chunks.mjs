import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const chunks = await prisma.documentChunk.findMany({
    where: { documentId: '82b21146-d78f-4ba0-8237-9715c6f6d4c4' },
    orderBy: { chunkIndex: 'asc' },
    select: { pageNumber: true, chunkIndex: true, content: true, metadata: true }
  });

  console.log(`Total chunks: ${chunks.length}`);
  // Print the first 20 chunks preview
  for (let i = 0; i < Math.min(chunks.length, 25); i++) {
    const c = chunks[i];
    const firstLine = c.content.split('\n').filter(l => l.trim().length > 0)[0] || '';
    console.log(`P${c.pageNumber} C${c.chunkIndex}: ${firstLine.substring(0, 100)}`);
  }
}

main().finally(() => prisma.$disconnect());
