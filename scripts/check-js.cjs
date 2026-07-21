const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SEARCH_ROOTS = ['functions', 'public', 'scripts', 'tests'];
const ignoredDirectories = new Set(['node_modules', '.git', '.firebase']);
const failures = [];

function checkJavaScript(file, source, label = path.relative(ROOT, file)) {
  const args = source == null ? ['--check', file] : ['--check', '-'];
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    input: source,
  });
  if (result.status !== 0) {
    failures.push({
      file: label,
      output: result.stderr || result.stdout,
    });
  }
}

function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collect(fullPath);
    } else if (entry.isFile() && /\.(?:js|cjs|mjs)$/.test(entry.name)) {
      checkJavaScript(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      const html = fs.readFileSync(fullPath, 'utf8');
      const scripts = html.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type=["']application\/(?:json|ld\+json)["'])[^>]*>([\s\S]*?)<\/script>/gi);
      let index = 0;
      for (const match of scripts) {
        index += 1;
        checkJavaScript(fullPath, match[1], `${path.relative(ROOT, fullPath)} (inline script ${index})`);
      }
    }
  }
}

SEARCH_ROOTS.forEach((relativePath) => collect(path.join(ROOT, relativePath)));

if (failures.length) {
  failures.forEach(({ file, output }) => {
    process.stderr.write(`\n${file}\n${output}\n`);
  });
  process.exitCode = 1;
} else {
  process.stdout.write('JavaScript syntax check passed.\n');
}
