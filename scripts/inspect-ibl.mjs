import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const materials = await prisma.material.findMany({
    where: { fileName: { contains: "InstanceBasedLearning" } },
    include: {
      chunks: {
        select: {
          id: true,
          pageNumber: true,
          chunkIndex: true,
          content: true,
        },
        orderBy: { chunkIndex: "asc" },
      },
    },
  });

  console.log(`Found ${materials.length} material(s) for InstanceBasedLearning`);
  for (const m of materials) {
    console.log(`\n========================================`);
    console.log(`Material ID: ${m.id}, Project ID: ${m.projectId}, File: ${m.fileName}`);
    console.log(`Chunks count: ${m.chunks.length}`);
    for (const c of m.chunks) {
      console.log(`\n--- Chunk ID: ${c.id} | Page: ${c.pageNumber} | Index: ${c.chunkIndex} ---`);
      console.log(c.content);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
