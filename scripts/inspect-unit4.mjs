import fs from 'fs';
const dump = JSON.parse(fs.readFileSync('db_dump.json', 'utf-8'));
const u4 = dump.materials.filter(m => m.fileName.toLowerCase().includes('unit-iv') || m.fileName.toLowerCase().includes('unit-v'));
console.log('Unit IV / V materials:');
console.log(JSON.stringify(u4, null, 2));

const projectIds = u4.map(m => m.projectId);
const relevantProjects = dump.projects.filter(p => projectIds.includes(p.id));
console.log('Relevant projects:');
console.log(JSON.stringify(relevantProjects, null, 2));

const relevantConcepts = dump.concepts.filter(c => projectIds.includes(c.projectId));
console.log('Relevant concepts count:', relevantConcepts.length);
console.log(JSON.stringify(relevantConcepts, null, 2));
