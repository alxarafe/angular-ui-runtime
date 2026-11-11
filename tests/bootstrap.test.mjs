import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { UI_RUNTIME_VERSION } from '../projects/ui-runtime/src/public-api.ts';

const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

test('public technical marker matches the distributable version', () => {
  const pkg = json('projects/ui-runtime/package.json');
  assert.equal(pkg.name, '@alxarafe/ui-runtime');
  assert.equal(UI_RUNTIME_VERSION, pkg.version);
});

test('library keeps Angular external and has no application dependencies', () => {
  const pkg = json('projects/ui-runtime/package.json');
  assert.deepEqual(pkg.peerDependencies, { '@angular/core': '^22.0.0' });
  assert.deepEqual(Object.keys(pkg.dependencies), ['tslib']);
  assert.equal(pkg.sideEffects, false);
});

test('production configuration preserves strict compilation and partial Angular output', () => {
  const base = json('tsconfig.json');
  const lib = json('projects/ui-runtime/tsconfig.lib.json');
  assert.equal(base.compilerOptions.strict, true);
  assert.equal(base.angularCompilerOptions.strictTemplates, true);
  assert.equal(lib.angularCompilerOptions.compilationMode, 'partial');
  assert.equal(json('projects/ui-runtime/ng-package.json').lib.entryFile, 'src/public-api.ts');
});
