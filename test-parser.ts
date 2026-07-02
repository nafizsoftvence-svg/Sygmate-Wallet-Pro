import fs from 'fs';

const filePath = 'src/App.tsx';
const content = fs.readFileSync(filePath, 'utf8');

const lines = content.split('\n');
const segment = lines.slice(11491, 11528).join('\n'); // lines 11492 to 11528

let i = 0;
while (i < segment.length) {
  const char = segment[i];
  const nextChar = segment[i + 1];

  if (char === '<') {
    console.log(`Found '<' at index ${i}, nextChar='${nextChar}', slice='${segment.substring(i, i + 10)}'`);
    if (nextChar === '>') {
      console.log(`-> MATCHED FRAGMENT OPEN at index ${i}`);
      i += 2;
      continue;
    }
  }
  i++;
}
