import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import test from 'node:test';

const expected = { alternative: ['field.BOOLEAN'], cyberpunk: ['shell', 'panel'], vintage: [], 'high-contrast': ['panel'] };
for (const [id, keys] of Object.entries(expected)) test(`${id} has its own sparse package and no private theme/consumer imports`, () => {
  const root = resolve(`packages/themes/${id}`);
  const json = file => JSON.parse(readFileSync(`${root}/${file}`, 'utf8'));
  const pkg = json('package.json'), manifest = json('theme-package.json');
  assert.equal(pkg.name, `@alxarafe/ui-theme-${id}`);
  assert.equal(pkg.private, true);
  assert.deepEqual(Object.keys(pkg.dependencies), ['tslib']);
  assert.deepEqual(Object.keys(pkg.peerDependencies).sort(), ['@alxarafe/ui-runtime', '@angular/core']);
  assert.equal(manifest.compatibility.runtimeSnapshotOnly, undefined);
  assert.equal(manifest.compatibility.requiredRuntimeRevision, undefined);
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.compatibility.uiRuntime, pkg.peerDependencies['@alxarafe/ui-runtime']);
  assert.equal(manifest.themes[0].id, id);
  assert.deepEqual(manifest.themes[0].artifacts, keys);
  assert.equal(json('PROVENANCE.json').revision, '8d1573c315e03a6edbc92bd7b3d41d851bd54ab9');
  assert.equal(readFileSync(`${root}/LICENSE`, 'utf8'), readFileSync('LICENSE', 'utf8'));
  for (const file of readdirSync(`${root}/src`).filter(file => file.endsWith('.ts'))) {
    const path = `${root}/src/${file}`, source = readFileSync(path, 'utf8');
    for (const [, specifier] of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      if (specifier.startsWith('.')) assert(resolve(dirname(path), specifier).startsWith(`${root}/src/`));
      else assert(['@angular/core', '@alxarafe/ui-runtime'].includes(specifier), `Forbidden import ${specifier}`);
    }
    if (id === 'vintage') assert(!source.includes('@Component'));
    if (id === 'alternative') assert(!source.includes('extends '));
  }
  assert(!/app-generic-resource|app-resource-form|\.resource-|\.login-shell|core-fe-/.test(readFileSync(`${root}/theme.css`, 'utf8')));
});
