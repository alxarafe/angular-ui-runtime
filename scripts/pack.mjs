import '@angular/compiler';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

const destination = '/artifacts';
mkdirSync(destination, { recursive: true });
const [result] = JSON.parse(execFileSync('npm', ['pack', './dist/ui-runtime', '--json', '--pack-destination', destination], { encoding: 'utf8' }));
assert.equal(result.name, '@alxarafe/ui-runtime');
assert.equal(result.version, '0.2.0');
const files = result.files.map(({ path }) => path);
for (const required of ['package.json', 'README.md', 'LICENSE', 'NOTICE']) assert(files.includes(required), `Missing ${required}`);
assert(files.some((file) => file.endsWith('.d.ts')), 'Missing declarations');
assert(files.some((file) => file.startsWith('fesm2022/') && file.endsWith('.mjs')), 'Missing ESM bundle');
assert(!files.some((file) => /(^|\/)(node_modules|tests|src|apps|testbed|scripts|docs|artifacts|screenshots|test-results|playwright-report)\//.test(file) || file.endsWith('.spec.ts')), 'Unexpected development files');
const unpacked = mkdtempSync(join(resolve('node_modules'), '.aur-package-'));
try {
  execFileSync('tar', ['-xzf', join(destination, result.filename), '-C', unpacked]);
  const root = join(unpacked, 'package');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.sideEffects, false);
  assert.equal(pkg.peerDependencies['@angular/core'], '^22.0.0');
  assert(!Object.keys(pkg.dependencies ?? {}).some((name) => name.startsWith('@angular/')), 'Angular must remain a peer');
  assert.equal(Object.keys(pkg.devDependencies ?? {}).length, 0, 'Development dependencies must not be distributed');
  assert(!Object.keys(pkg.dependencies ?? {}).some((name) => name.includes('playwright')), 'Browser tooling must not be a library dependency');
  for (const condition of ['types', 'default']) {
    const entry = pkg.exports['.'][condition];
    assert(entry?.startsWith('./'), `Missing public ${condition} export`);
    readFileSync(resolve(root, entry));
  }
  assert.equal(readFileSync(join(root, 'LICENSE'), 'utf8'), readFileSync('LICENSE', 'utf8'));
  const { UI_RUNTIME_VERSION } = await import(resolve(root, pkg.exports['.'].default));
  assert.equal(UI_RUNTIME_VERSION, pkg.version);
} finally {
  rmSync(unpacked, { recursive: true, force: true });
}
console.log(`PACK PASS: ${destination}/${result.filename} (APF exports, declarations, ESM, license and contents verified)`);
