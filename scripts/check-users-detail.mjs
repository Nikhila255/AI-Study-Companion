import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'nikhilamadem9@gmail.com' },
    include: {
      spaces: {
        include: {
          projects: {
            include: {
              materials: true,
              concepts: true,
              _count: {
                select: { materials: true, concepts: true, assessments: true, masteryRecords: true }
              }
            }
          }
        }
      }
    }
  });
  console.log('User nikhilamadem9@gmail.com:', JSON.stringify(user, null, 2));

  // Also check tester_1789648523194@studycompanion.dev
  const tester = await prisma.user.findUnique({
    where: { email: 'tester_1789648523194@studycompanion.dev' },
    include: {
      spaces: {
        include: {
          projects: {
            include: {
              materials: true,
              concepts: true
            }
          }
        }
      }
    }
  });
  console.log('Tester user:', JSON.stringify(tester, null, 2));
}

main().finally(() => prisma.$disconnect());
