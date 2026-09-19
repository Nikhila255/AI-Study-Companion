import fs from 'fs';
const dump = JSON.parse(fs.readFileSync('db_dump.json', 'utf-8'));
console.log('Attempts count:', dump.attempts.length);
for (const a of dump.attempts) {
  console.log('Attempt:', a);
}
console.log('Mastery count:', dump.mastery.length);
for (const m of dump.mastery) {
  console.log('Mastery:', m);
}
