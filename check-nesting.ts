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

const returnIndex = componentCode.indexOf('return (');
if (returnIndex === -1) {
  console.log('Could not find return statement.');
  process.exit(1);
}

const returnBlock = componentCode.substring(returnIndex);
const absoluteReturnStartCharIndex = startIndex + returnIndex;

const getAbsoluteLineNumber = (charIndex: number) => {
  return content.substring(0, absoluteReturnStartCharIndex + charIndex).split('\n').length;
};

// Structural tags
const allowedTags = new Set([
  'div', 'aside', 'nav', 'section', 'button', 'form',
  'motion.div', 'AnimatePresence', 'main', 'header', 'footer'
]);

const tags: { name: string, isClosing: boolean, line: number, text: string }[] = [];
const regex = /<(\/?)([a-zA-Z0-9\.-]+)(?:\.([a-zA-Z0-9\.-]+))?(\s+[^>]*)?>/g;
let match;

while ((match = regex.exec(returnBlock)) !== null) {
  const isClosing = match[1] === '/';
  let tagName = match[2];
  if (match[3]) {
    tagName = `${tagName}.${match[3]}`;
  }
  const fullTag = match[0];
  
  if (!allowedTags.has(tagName)) continue;
  if (fullTag.endsWith('/>')) continue;

  const line = getAbsoluteLineNumber(match.index);
  tags.push({ name: tagName, isClosing, line, text: fullTag });
}

let openTags: { name: string, line: number }[] = [];
for (const tag of tags) {
  if (tag.isClosing) {
    if (openTags.length === 0) {
      console.log(`Error: Extra closing tag </${tag.name}> at line ${tag.line}`);
    } else {
      // In JSX, </motion.div> matches <motion.div>, but let's allow </div> to close <motion.div> for the sake of simple analysis if the developer wrote it, or let's be strict.
      // Actually, let's treat motion.div and div as matching for simple layout tracking if they are closed by either.
      const lastOpen = openTags.pop();
      const matchFound = (lastOpen && (lastOpen.name === tag.name || 
                        (lastOpen.name === 'motion.div' && tag.name === 'div') ||
                        (lastOpen.name === 'div' && tag.name === 'motion.div')));
      if (!matchFound) {
        console.log(`Error: Mismatched tags! Opened <${lastOpen?.name}> at line ${lastOpen?.line}, closed with </${tag.name}> at line ${tag.line}`);
        if (lastOpen) openTags.push(lastOpen);
      }
    }
  } else {
    openTags.push({ name: tag.name, line: tag.line });
  }
}

if (openTags.length > 0) {
  console.log('\nUnclosed tags remaining in AgentDashboard (exact lines of App.tsx):');
  openTags.forEach(t => console.log(`- <${t.name}> opened at line ${t.line}`));
} else {
  console.log('\nAll structural tags are perfectly balanced!');
}
