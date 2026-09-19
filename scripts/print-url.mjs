import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  const proj = await prisma.project.findUnique({
    where: { id: "3f719e4e-2547-493a-953d-23537ec140ba" },
    include: { space: true, user: true }
  });
  console.log("PROJECT_URL: http://localhost:3000/spaces/" + proj.spaceId + "/projects/" + proj.id);
  console.log("USER_EMAIL:", proj.user.email);
}
main().finally(() => prisma.$disconnect());
