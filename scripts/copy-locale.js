// scripts/copy-locale.js
const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'node_modules', 'lighthouse', 'shared', 'localization', 'locales');
const sourceLocale = path.join(localesDir, 'en-US.json'); // existing locale file
const targetLocale = path.join(localesDir, 'ar.json');      // file Lighthouse is trying to load

try {
  if (!fs.existsSync(targetLocale)) {
    fs.copyFileSync(sourceLocale, targetLocale);
    console.log(`Copied ${sourceLocale} to ${targetLocale}`);
  } else {
    console.log(`${targetLocale} already exists.`);
  }
} catch (error) {
  console.error('Error copying locale file:', error);
  process.exit(1);
}