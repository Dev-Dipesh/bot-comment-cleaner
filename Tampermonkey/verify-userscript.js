#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const file = path.join(root, 'Tampermonkey', 'bot-comment-cleaner.js');

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(file)) {
  fail('Missing Tampermonkey/bot-comment-cleaner.js');
  process.exit(process.exitCode || 1);
}

const text = fs.readFileSync(file, 'utf8');

if (!text.includes('// ==UserScript==') || !text.includes('// ==/UserScript==')) {
  fail('Missing userscript metadata block');
}

const requiredMeta = [
  '@name',
  '@version',
  '@description',
  '@run-at',
  '@match'
];

for (const key of requiredMeta) {
  const re = new RegExp(`^\\/\\/\\s+${key.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'm');
  if (!re.test(text)) {
    fail(`Missing metadata: ${key}`);
  }
}

const requiredGrants = ['GM_getValue', 'GM_setValue', 'GM_addStyle', 'GM_xmlhttpRequest'];
for (const grant of requiredGrants) {
  const grantRe = new RegExp(`^\\/\\/\\s+@grant\\s+${grant}\\b`, 'm');
  if (!grantRe.test(text)) {
    fail(`Missing metadata: @grant ${grant}`);
  }
}

const matchCount = (text.match(/^\/\/\s+@match\s+/gm) || []).length;
if (matchCount < 5) {
  fail(`Expected multiple @match entries, found ${matchCount}`);
}

if (/\bchrome\./.test(text)) {
  fail('Found chrome.* API reference (extension-only API)');
}

if (/\bbrowser\./.test(text)) {
  fail('Found browser.* API reference (extension-only API)');
}

if (/^\/\/\s+@require\s+/m.test(text)) {
  fail('Found @require dependency; userscript must stay one-file');
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('PASS: userscript metadata and portability checks succeeded');
