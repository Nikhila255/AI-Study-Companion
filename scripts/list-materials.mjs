import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const materials = await prisma.material.findMany({
    include: {
      project: {
        include: {
          user: true,
          space: true,
        },
      },
    },
  });

  console.log(`Found ${materials.length} materials:`);
  for (const m of materials) {
    console.log(`- ID: ${m.id}`);
    console.log(`  File: ${m.fileName}`);
    console.log(`  Status: ${m.status}`);
    console.log(`  Project: ${m.project.name} (${m.projectId})`);
    console.log(`  Space: ${m.project.space?.name} (${m.project.spaceId})`);
    console.log(`  User: ${m.project.user?.email} (${m.project.userId})`);
    console.log(`  Pages: ${m.totalPages}`);
    console.log("-----------------------------------------");
  }
}

main().finally(() => prisma.$disconnect());
