import { PrismaClient } from "@prisma/client";
import { getConceptsForProjectAndMaterial } from "../src/lib/concept-extractor.ts";

const prisma = new PrismaClient();

async function main() {
  const projectId = "3f719e4e-2547-493a-953d-23537ec140ba";
  const materialId = "78914ec5-c6cc-4e01-b1ec-5a1b13b718cb";
  const userId = "e4939acb-0f18-498c-9ba8-bc20add70427";

  const concepts = await getConceptsForProjectAndMaterial(projectId, materialId, userId);
  console.log(`=== Extracted ${concepts.length} concepts for IBL ===`);
  for (const c of concepts) {
    console.log(`- ${c.name} (Score: ${c.importanceScore})`);
  }
}

main().finally(() => prisma.$disconnect());
