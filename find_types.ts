import fs from 'fs';
import path from 'path';

function findFiles(dir: string, pattern: RegExp) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      findFiles(fullPath, pattern);
    } else if (pattern.test(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('LiveServerMessage')) {
        console.log(`Found in ${fullPath}`);
        const lines = content.split('\n');
        const idx = lines.findIndex(l => l.includes('LiveServerMessage'));
        console.log(lines.slice(Math.max(0, idx - 5), idx + 20).join('\n'));
      }
    }
  }
}

findFiles('node_modules/@google/genai', /\.d\.ts$/);
