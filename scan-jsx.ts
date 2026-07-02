import fs from 'fs';

const filePath = 'src/App.tsx';
const content = fs.readFileSync(filePath, 'utf8');

const startStr = 'function AgentDashboard';
const endStr = 'function CustomerDashboard';

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex === -1 || endIndex === -1) {
  console.log('Could not locate components.');
  process.exit(1);
}

const componentCode = content.substring(startIndex, endIndex);

let tagStack: { name: string, line: number }[] = [];

const getAbsoluteLineNumber = (charIndex: number) => {
  return content.substring(0, startIndex + charIndex).split('\n').length;
};

// Simple self-closing tags
const selfClosingTags = new Set([
  'img', 'input', 'br', 'hr', 'meta', 'link'
]);

// TypeScript types/generics to ignore so they don't get treated as JSX tags
const ignoredTypes = new Set([
  'Transaction', 'SystemSettings', 'UserProfile', 'string', 'Receiver',
  'HTMLImageElement', 'SystemAlert', 'Record', 'EmailLog', 'number',
  'boolean', 'any', 'User', 'Wallet', 'RefObject', 'CanvasRenderingContext2D',
  'HTMLCanvasElement', 'SVGElement', 'HTMLButtonElement', 'HTMLDivElement'
]);

let i = 0;
while (i < componentCode.length) {
  const char = componentCode[i];
  const nextChar = componentCode[i + 1];

  const absoluteLine = getAbsoluteLineNumber(i);

  // Skip comments
  if (char === '/' && nextChar === '/') {
    while (i < componentCode.length && componentCode[i] !== '\n') {
      i++;
    }
    continue;
  }
  if (char === '/' && nextChar === '*') {
    i += 2;
    while (i < componentCode.length && !(componentCode[i] === '*' && componentCode[i + 1] === '/')) {
      i++;
    }
    i += 2;
    continue;
  }

  // Parse a tag
  if (char === '<') {
    // Check if it's a Fragment opening `<>`
    if (nextChar === '>') {
      tagStack.push({ name: 'Fragment', line: absoluteLine });
      i += 2;
      continue;
    }

    // Check if it's a Fragment closing `</>`
    if (nextChar === '/' && componentCode[i + 2] === '>') {
      if (tagStack.length === 0) {
        console.log(`Error: Extra closing tag </Fragment> at line ${absoluteLine}`);
      } else {
        const last = tagStack[tagStack.length - 1];
        if (last.name === 'Fragment') {
          tagStack.pop();
        } else {
          console.log(`Error: Tag mismatch! Expected </${last.name}> (opened at line ${last.line}), but got </Fragment> at line ${absoluteLine}`);
          tagStack.pop();
        }
      }
      i += 3;
      continue;
    }

    // Must be a valid tag starter
    if (nextChar === '/' || /^[a-zA-Z]/.test(nextChar)) {
      const tagStart = i;
      const isClosing = nextChar === '/';
      i += isClosing ? 2 : 1;

      // Extract tag name
      let name = '';
      while (i < componentCode.length && /^[a-zA-Z0-9\.\-_]/.test(componentCode[i])) {
        name += componentCode[i];
        i++;
      }

      // If it is a generic type parameter (like Array<string>), do not treat as tag
      if (ignoredTypes.has(name)) {
        i = tagStart + 1; // back to after the '<'
        continue;
      }

      // Parse attributes until '>' or '/>'
      let isSelfClosing = false;
      let inQuote: string | null = null;
      let braceDepth = 0;

      while (i < componentCode.length) {
        const c = componentCode[i];
        const nextC = componentCode[i + 1];

        if (inQuote) {
          if (c === '\\') {
            i += 2;
            continue;
          }
          if (c === inQuote) {
            inQuote = null;
          }
          i++;
          continue;
        }

        if (c === '"' || c === "'" || c === '`') {
          inQuote = c;
          i++;
          continue;
        }

        if (c === '{') {
          braceDepth++;
          i++;
          continue;
        }

        if (c === '}') {
          braceDepth--;
          i++;
          continue;
        }

        // Only handle tag boundaries if we are not inside braces or quotes
        if (braceDepth === 0) {
          if (c === '/' && nextC === '>') {
            isSelfClosing = true;
            i += 2;
            break;
          }
          if (c === '>') {
            i++;
            break;
          }
        }

        i++;
      }

      if (isClosing) {
        if (tagStack.length === 0) {
          console.log(`Error: Extra closing tag </${name}> at line ${absoluteLine}`);
        } else {
          const last = tagStack[tagStack.length - 1];
          if (last.name === name) {
            tagStack.pop();
          } else {
            // Log mismatched tags for debugging
            if (name === 'div' || name === 'form' || name === 'section' || name === 'button') {
              console.log(`Error: Tag mismatch! Expected </${last.name}> (opened at line ${last.line}), but got </${name}> at line ${absoluteLine}`);
            }
            tagStack.pop(); // Pop to try and recover
          }
        }
      } else {
        if (!isSelfClosing && !selfClosingTags.has(name) && name !== '') {
          tagStack.push({ name, line: absoluteLine });
        }
      }
      continue;
    }
  }

  i++;
}

console.log('\n--- Final JSX Tag Stack Trace ---');
console.log('JSON tagStack:', JSON.stringify(tagStack, null, 2));
