const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("Preparing secure build environment...");

try {
  require.resolve('javascript-obfuscator');
} catch (e) {
  console.log("Installing javascript-obfuscator...");
  execSync('npm install --save-dev javascript-obfuscator', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
}

const JavaScriptObfuscator = require('javascript-obfuscator');

const ROOT_DIR = path.join(__dirname, '..');
const DEST_DIR = path.join(ROOT_DIR, 'dist_obfuscated');
const SRC_ITEMS = ['src', 'main.js', 'preload.js'];

// 1. Clean destination
if (fs.existsSync(DEST_DIR)) {
  fs.rmSync(DEST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DEST_DIR);

// 2. Copy and Obfuscate function
function processItem(sourcePath, destPath) {
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
    fs.readdirSync(sourcePath).forEach(file => {
      processItem(path.join(sourcePath, file), path.join(destPath, file));
    });
  } else {
    if (sourcePath.endsWith('.js')) {
      try {
        const code = fs.readFileSync(sourcePath, 'utf8');
        // Very strong obfuscation parameters
        const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
          compact: true,
          controlFlowFlattening: true,
          controlFlowFlatteningThreshold: 0.75,
          deadCodeInjection: true,
          deadCodeInjectionThreshold: 0.4,
          identifierNamesGenerator: 'hexadecimal',
          stringArray: true,
          stringArrayEncoding: ['base64'],
          stringArrayThreshold: 0.75,
          target: 'node'
        });
        fs.writeFileSync(destPath, obfuscationResult.getObfuscatedCode());
        console.log(`🔒 Obfuscated: ${path.basename(sourcePath)}`);
      } catch (err) {
        console.error(`Error obfuscating ${sourcePath}:`, err);
        fs.copyFileSync(sourcePath, destPath);
      }
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

SRC_ITEMS.forEach(item => {
  const fullSrc = path.join(ROOT_DIR, item);
  if (fs.existsSync(fullSrc)) {
    processItem(fullSrc, path.join(DEST_DIR, item));
  }
});

console.log("✅ Obfuscation complete. Ready for secure packaging!");
