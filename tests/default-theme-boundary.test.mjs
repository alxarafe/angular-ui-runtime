import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import test from 'node:test';
import { THEME_ARTIFACTS } from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';

test('independent default package has a complete versioned manifest and no consumer imports', () => {
  const root = resolve('packages/themes/default');
  const json = file => JSON.parse(readFileSync(`${root}/${file}`, 'utf8'));
  const pkg = json('package.json'), manifest = json('theme-package.json');
  assert.equal(pkg.name, '@alxarafe/ui-theme-default');
  assert.equal(pkg.private, true);
  assert.deepEqual(Object.keys(pkg.dependencies), ['tslib']);
  assert.deepEqual(Object.keys(pkg.peerDependencies).sort(), ['@alxarafe/ui-runtime', '@angular/core']);
  assert.equal(manifest.compatibility.runtimeSnapshotOnly, undefined);
  assert.equal(manifest.compatibility.requiredRuntimeRevision, undefined);
  assert.equal(manifest.version, pkg.version);
  assert.equal(manifest.compatibility.uiRuntime, pkg.peerDependencies['@alxarafe/ui-runtime']);
  assert.equal(manifest.themes[0].id, 'default');
  assert.deepEqual([...manifest.themes[0].artifacts].sort(), [...THEME_ARTIFACTS].sort());
  for (const file of readdirSync(`${root}/src`).filter(file => file.endsWith('.ts'))) {
    const path = `${root}/src/${file}`;
    for (const [, specifier] of readFileSync(path, 'utf8').matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      if (specifier.startsWith('.')) assert(resolve(dirname(path), specifier).startsWith(`${root}/src/`));
      else assert(['@angular/core', '@alxarafe/ui-runtime'].includes(specifier), `Forbidden theme import: ${specifier}`);
    }
  }
  const css = readFileSync(`${root}/theme.css`, 'utf8');
  assert(!/app-generic-resource|app-resource-form|\.resource-|\.login-shell|core-fe-/.test(css));
});
