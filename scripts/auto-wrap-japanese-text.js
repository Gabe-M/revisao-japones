import ts from 'typescript';
import fs from 'fs';
import path from 'path';

const jpRegex = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/;

function analyzeAndFix(filePath, code) {
  const sourceFile = ts.createSourceFile(
    filePath,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );

  let hasFuriganaTextImport = false;
  let furiganaTextImportRange = null;
  let hasInteractiveTextImport = false;
  let lastImportEnd = 0;
  const replacements = [];

  // Helper to check if a node has InteractiveText as parent/ancestor
  function isWrapped(node) {
    let parent = node.parent;
    while (parent) {
      if (ts.isJsxElement(parent)) {
        const tagName = parent.openingElement.tagName.getText(sourceFile);
        if (tagName === 'InteractiveText') return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  function visit(node) {
    // 1. Check imports
    if (ts.isImportDeclaration(node)) {
      lastImportEnd = node.getEnd();
      const importText = node.getText(sourceFile);
      if (importText.includes('FuriganaText')) {
        hasFuriganaTextImport = true;
        furiganaTextImportRange = { start: node.getStart(sourceFile), end: node.getEnd() };
      }
      if (importText.includes('InteractiveText')) {
        hasInteractiveTextImport = true;
      }
    }

    // 2. JsxSelfClosingElement / JsxElement for FuriganaText
    if (ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      if (tagName === 'FuriganaText') {
        replacements.push({
          start: node.tagName.getStart(sourceFile),
          end: node.tagName.getEnd(),
          text: 'InteractiveText'
        });
      }
    } else if (ts.isJsxElement(node)) {
      const tagName = node.openingElement.tagName.getText(sourceFile);
      if (tagName === 'FuriganaText') {
        replacements.push({
          start: node.openingElement.tagName.getStart(sourceFile),
          end: node.openingElement.tagName.getEnd(),
          text: 'InteractiveText'
        });
        replacements.push({
          start: node.closingElement.tagName.getStart(sourceFile),
          end: node.closingElement.tagName.getEnd(),
          text: 'InteractiveText'
        });
      }
    }

    // 3. JsxText containing Japanese
    if (ts.isJsxText(node)) {
      const text = node.getText(sourceFile);
      if (text.trim() && jpRegex.test(text)) {
        if (!isWrapped(node)) {
          // Wrap the text node
          replacements.push({
            start: node.getStart(sourceFile),
            end: node.getEnd(),
            text: `<InteractiveText>${text}</InteractiveText>`
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (replacements.length === 0) {
    return { modified: false, newCode: code };
  }

  // Handle imports
  if (hasFuriganaTextImport && furiganaTextImportRange) {
    // Delete the FuriganaText import
    replacements.push({
      start: furiganaTextImportRange.start,
      end: furiganaTextImportRange.end,
      text: '' // Remove it
    });
  }

  // Add InteractiveText import if missing
  if (!hasInteractiveTextImport) {
    const targetPath = path.resolve('src/components/InteractiveText');
    const sourceDir = path.dirname(filePath);
    let relPath = path.relative(sourceDir, targetPath).replace(/\\/g, '/');
    if (!relPath.startsWith('.')) {
      relPath = './' + relPath;
    }
    const cleanImportPath = relPath.replace(/\.(tsx|ts)$/, '');
    const importStr = `import InteractiveText from '${cleanImportPath}';\n`;

    // Insert at the position of the deleted FuriganaText import, or after lastImportEnd
    if (hasFuriganaTextImport && furiganaTextImportRange) {
      replacements.push({
        start: furiganaTextImportRange.start,
        end: furiganaTextImportRange.start,
        text: importStr.trim() // Put the new import here
      });
    } else {
      replacements.push({
        start: lastImportEnd,
        end: lastImportEnd,
        text: `\n${importStr}`
      });
    }
  }

  // Sort replacements descending by start position to prevent index shift
  replacements.sort((a, b) => b.start - a.start);

  let newCode = code;
  for (const rep of replacements) {
    newCode = newCode.slice(0, rep.start) + rep.text + newCode.slice(rep.end);
  }

  return { modified: true, newCode };
}

function processFile(filePath) {
  // Normalize path
  const fullPath = path.resolve(filePath);
  
  // Skip the InteractiveText component itself
  if (fullPath.includes('InteractiveText.tsx') || fullPath.includes('InteractiveText.jsx')) {
    return;
  }

  try {
    const code = fs.readFileSync(fullPath, 'utf8');
    const { modified, newCode } = analyzeAndFix(fullPath, code);
    if (modified) {
      fs.writeFileSync(fullPath, newCode, 'utf8');
      console.log(`[auto-wrap-jp] Automatically wrapped Japanese text in: ${filePath}`);
    }
  } catch (err) {
    console.error(`[auto-wrap-jp] Error processing ${filePath}:`, err.message);
  }
}

// CLI routing
const args = process.argv.slice(2);
const fileIdx = args.indexOf('--file');
const watchMode = args.includes('--watch');

if (fileIdx !== -1 && args[fileIdx + 1]) {
  processFile(args[fileIdx + 1]);
} else if (watchMode) {
  console.log('[auto-wrap-jp] Watching src/ directory for Japanese text changes...');
  const watchDir = path.resolve('src');
  
  // Recursive watch on Windows
  fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
    if (filename && (filename.endsWith('.tsx') || filename.endsWith('.jsx'))) {
      const fullPath = path.join(watchDir, filename);
      // Wait a brief moment to ensure write operation is complete
      setTimeout(() => {
        if (fs.existsSync(fullPath)) {
          processFile(fullPath);
        }
      }, 100);
    }
  });
} else {
  // Default: scan entire src folder once
  console.log('[auto-wrap-jp] Scanning all .tsx/.jsx files in src/...');
  function walk(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
      } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
        processFile(fullPath);
      }
    }
  }
  walk(path.resolve('src'));
  console.log('[auto-wrap-jp] Scan complete.');
}
