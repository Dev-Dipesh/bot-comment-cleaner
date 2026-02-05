#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// Minimal browser globals for filters.js
if (!global.window) global.window = {};
if (!global.chrome) {
  global.chrome = {
    runtime: {
      getURL: (p) => path.resolve(root, p)
    }
  };
}

if (!global.fetch) {
  global.fetch = async (url) => {
    try {
      const filePath = url.startsWith('file://') ? url.slice(7) : url;
      const text = await fs.promises.readFile(filePath, 'utf8');
      return { ok: true, text: async () => text };
    } catch {
      return { ok: false, text: async () => '' };
    }
  };
}

require(path.join(root, 'filters.js'));

async function loadTests() {
  const file = path.join(root, 'tests', 'comments.json');
  const raw = await fs.promises.readFile(file, 'utf8');
  return JSON.parse(raw);
}

function formatResult(result) {
  return `spam=${result.isSpam} confidence=${result.confidence} reasons=${result.reasons.join('; ')}`;
}

async function run() {
  const tests = await loadTests();

  // Allow the async wordlist load to run once
  await new Promise(resolve => setTimeout(resolve, 10));

  const classify = global.window.BotCommentFilters?.classifyComment;
  if (typeof classify !== 'function') {
    console.error('Filters not loaded.');
    process.exit(2);
  }

  let pass = 0;
  let fail = 0;

  tests.forEach((t, idx) => {
    const result = classify(t.text, t.username || '', t.links || []);
    const ok = result.isSpam === Boolean(t.expectedSpam);
    const label = ok ? 'PASS' : 'FAIL';
    const note = t.note ? ` - ${t.note}` : '';
    console.log(`[${label}] #${idx + 1}${note}`);
    if (!ok) {
      console.log(`  expectedSpam=${Boolean(t.expectedSpam)}`);
      console.log(`  ${formatResult(result)}`);
    }
    if (ok) pass += 1; else fail += 1;
  });

  console.log(`\nSummary: ${pass} passed, ${fail} failed, ${tests.length} total`);
  process.exit(fail === 0 ? 0 : 1);
}

run().catch(err => {
  console.error(err);
  process.exit(2);
});
