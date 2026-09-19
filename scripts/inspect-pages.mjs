import fs from 'fs';
import path from 'path';
import { extractTextFromPDF } from '../src/lib/pdf-processor.js';

async function main() {
  const filePath = 'C:/Users/Nikhila/.gemini/antigravity-ide/scratch/ai-study-companion/uploads/3f719e4e-2547-493a-953d-23537ec140ba_1789661649065_AI_Knowledge_Management_Literature_Survey.pdf';
  const { pages, totalPages } = await extractTextFromPDF(filePath);
  console.log(`Total Pages: ${totalPages}`);
  for (let i = 0; i < Math.min(pages.length, 4); i++) {
    console.log(`=== PAGE ${pages[i].pageNumber} === (length: ${pages[i].text.length})`);
    console.log(pages[i].text.substring(0, 300));
    console.log('...\n[END OF PAGE PREVIEW]');
  }
}

main();
