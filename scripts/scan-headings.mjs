import { extractTextFromPDF } from '../src/lib/pdf-processor.js';

async function main() {
  const filePath = 'C:/Users/Nikhila/.gemini/antigravity-ide/scratch/ai-study-companion/uploads/3f719e4e-2547-493a-953d-23537ec140ba_1789661649065_AI_Knowledge_Management_Literature_Survey.pdf';
  const { pages } = await extractTextFromPDF(filePath);
  
  const headingRegex = /(?:^|\n)\s*(\d+(?:\.\d+)*\s+[A-Z][^\n]+)/g;
  console.log('=== SECTIONS FOUND ACROSS 31 PAGES ===');
  for (const p of pages) {
    let match;
    while ((match = headingRegex.exec(p.text)) !== null) {
      console.log(`Page ${p.pageNumber}: ${match[1].trim()}`);
    }
  }
}

main();
