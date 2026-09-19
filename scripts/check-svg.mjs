import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const chunks = await prisma.documentChunk.findMany({
    where: { content: { contains: 'svg' } },
    select: { id: true, documentId: true, pageNumber: true, content: true, document: { select: { fileName: true } } }
  });
  console.log('Chunks with svg:', chunks.length);
  for (const c of chunks) {
    console.log(`[${c.document.fileName} Page ${c.pageNumber}] ${c.content}`);
  }
}

main().finally(() => prisma.$disconnect());
