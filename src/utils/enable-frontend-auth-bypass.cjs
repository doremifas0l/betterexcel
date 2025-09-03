// Script to enable frontend authentication bypass
// This will modify the built application to automatically enable bypass mode

const fs = require('fs');
const path = require('path');

// Find the main JS file in dist/assets
const assetsDir = path.join(__dirname, 'dist', 'assets');
const files = fs.readdirSync(assetsDir).filter(f => f.startsWith('index-') && f.endsWith('.js'));

if (files.length === 0) {
  console.error('No index JS files found in dist/assets');
  process.exit(1);
}

const mainJsFile = path.join(assetsDir, files[0]);
console.log('Modifying file:', mainJsFile);

// Read the main JS file
let content = fs.readFileSync(mainJsFile, 'utf8');

// Add localStorage bypass setting at the beginning
const bypassCode = `localStorage.setItem('bypassAuth', 'true');console.log('Frontend auth bypass enabled');`;

// Inject the bypass code at the beginning
content = bypassCode + content;

// Write the file back
fs.writeFileSync(mainJsFile, content);
console.log('Frontend auth bypass has been enabled in the built application');
