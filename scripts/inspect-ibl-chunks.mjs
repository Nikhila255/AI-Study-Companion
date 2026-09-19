import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const materials = await prisma.material.findMany({
    where: { fileName: { contains: "InstanceBasedLearning" } },
    include: {
      chunks: {
        take: 10,
        select: { id: true, pageNumber: true, chunkIndex: true, content: true }
      }
    }
  });

  console.log(`Found ${materials.length} InstanceBasedLearning materials:`);
  for (const m of materials) {
    console.log(`Material ID: ${m.id}, fileName: ${m.fileName}, status: ${m.status}, total chunks: ${m.chunks.length}`);
    for (const c of m.chunks.slice(0, 5)) {
      console.log(`--- Page ${c.pageNumber}, Chunk ${c.chunkIndex} ---`);
      console.log(c.content.slice(0, 200));
    }
  }
}

main().finally(() => prisma.$disconnect());
