import fs from 'fs';

const filePath = 'src/App.tsx';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// We propose adding:
// 1. Two closing </div> tags at line 11052 (after the mobile nav block ends)
// 2. One closing </div> tag at line 11186 (after the desktop top bar ends)

// Let's insert them into lines
lines.splice(11051, 0, '      </div>', '    </div>');
// Note: Inserting 2 lines shifts the next target from 11186 to 11188
lines.splice(11187, 0, '      </div>');

const modifiedContent = lines.join('\n');
const modifiedLines = modifiedContent.split('\n');

// Now let's scan START_SECTION on the modified content
const block = { name: 'START_SECTION', start: 10706, end: 11191 }; // extended end because of inserted lines
const blockCode = modifiedLines.slice(block.start - 1, block.end).join('\n');

let tagStack: { name: string, line: number }[] = [];
const selfClosingTags = new Set(['img', 'input', 'br', 'hr', 'meta', 'link']);
const ignoredTypes = new Set([
  'Transaction', 'SystemSettings', 'UserProfile', 'string', 'Receiver',
  'HTMLImageElement', 'SystemAlert', 'Record', 'EmailLog', 'number',
  'boolean', 'any', 'User', 'Wallet', 'RefObject', 'CanvasRenderingContext2D',
  'HTMLCanvasElement', 'SVGElement', 'HTMLButtonElement', 'HTMLDivElement'
]);

let i = 0;
while (i < blockCode.length) {
  const char = blockCode[i];
  const nextChar = blockCode[i + 1];

  if (char === '/' && nextChar === '/') {
    while (i < blockCode.length && blockCode[i] !== '\n') i++;
    continue;
  }
  if (char === '/' && nextChar === '*') {
    i += 2;
    while (i < blockCode.length && !(blockCode[i] === '*' && blockCode[i + 1] === '/')) i++;
    i += 2;
    continue;
  }

  if (char === '<') {
    if (nextChar === '>') {
      tagStack.push({ name: 'Fragment', line: block.start + blockCode.substring(0, i).split('\n').length - 1 });
      i += 2;
      continue;
    }
    if (nextChar === '/' && blockCode[i + 2] === '>') {
      tagStack.pop();
      i += 3;
      continue;
    }

    if (nextChar === '/' || /^[a-zA-Z]/.test(nextChar)) {
      const tagStart = i;
      const isClosing = nextChar === '/';
      i += isClosing ? 2 : 1;

      let name = '';
      while (i < blockCode.length && /^[a-zA-Z0-9\.\-_]/.test(blockCode[i])) {
        name += blockCode[i];
        i++;
      }

      if (ignoredTypes.has(name)) {
        i = tagStart + 1;
        continue;
      }

      let isSelfClosing = false;
      let inQuote: string | null = null;
      let braceDepth = 0;

      while (i < blockCode.length) {
        const c = blockCode[i];
        const nextC = blockCode[i + 1];

        if (inQuote) {
          if (c === '\\') { i += 2; continue; }
          if (c === inQuote) inQuote = null;
          i++;
          continue;
        }
        if (c === '"' || c === "'" || c === '`') {
          inQuote = c;
          i++;
          continue;
        }
        if (c === '{') { braceDepth++; i++; continue; }
        if (c === '}') { braceDepth--; i++; continue; }

        if (braceDepth === 0) {
          if (c === '/' && nextC === '>') { isSelfClosing = true; i += 2; break; }
          if (c === '>') { i++; break; }
        }
        i++;
      }

      const line = block.start + blockCode.substring(0, tagStart).split('\n').length - 1;

      if (isClosing) {
        if (tagStack.length > 0) {
          const last = tagStack[tagStack.length - 1];
          if (last.name === name) {
            tagStack.pop();
          } else {
            tagStack.pop(); // Pop to recover
          }
        }
      } else {
        if (!isSelfClosing && !selfClosingTags.has(name) && name !== '') {
          tagStack.push({ name, line });
        }
      }
      continue;
    }
  }
  i++;
}

console.log(`\n--- Modified START_SECTION Scan ---`);
if (tagStack.length > 0) {
  console.log(`Unbalanced tags inside START_SECTION:`);
  tagStack.forEach(t => console.log(`- <${t.name}> opened at line ${t.line}`));
} else {
  console.log(`START_SECTION is now perfectly balanced!`);
}
