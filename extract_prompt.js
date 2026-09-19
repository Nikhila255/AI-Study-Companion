const fs = require('fs');
const readline = require('readline');

async function main() {
  const file = 'C:/Users/Nikhila/.gemini/antigravity-ide/brain/801380a0-0900-47fd-8aa0-4f1b881114ce/.system_generated/logs/transcript_full.jsonl';
  const fileStream = fs.createReadStream(file);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  let lastPrompt = '';
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.source === 'USER_EXPLICIT' && obj.content && obj.content.includes('MASTER UX/UI REDESIGN')) {
        lastPrompt = obj.content;
      }
    } catch (e) {}
  }
  fs.writeFileSync('C:/Users/Nikhila/.gemini/antigravity-ide/scratch/ai-study-companion/full_user_prompt.txt', lastPrompt, 'utf-8');
  console.log('Saved full prompt, length:', lastPrompt.length);
}

main().catch(console.error);
