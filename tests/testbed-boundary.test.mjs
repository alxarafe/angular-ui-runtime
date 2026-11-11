import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import test from 'node:test';

test('QA testbed is private, has independent dependencies and no library source aliases', () => {
  const root = resolve('apps/testbed/src');
  const pkg = JSON.parse(readFileSync('apps/testbed/package.json', 'utf8'));
  const config = JSON.parse(readFileSync('apps/testbed/tsconfig.json', 'utf8'));
  assert.equal(pkg.private, true);
  assert.equal(config.extends, undefined);
  assert.equal(config.compilerOptions.paths, undefined);
  assert.equal(config.compilerOptions.baseUrl, undefined);
  for (const file of readdirSync(root).filter(name => name.endsWith('.ts'))) {
    const path = resolve(root, file);
    const text = readFileSync(path, 'utf8');
    for (const [, specifier] of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      if (specifier.startsWith('.')) {
        assert(resolve(dirname(path), specifier).startsWith(`${root}/`), `Import escapes testbed: ${specifier}`);
      } else {
        assert(['@angular/core', '@angular/platform-browser', '@alxarafe/ui-runtime'].includes(specifier), `Nonpublic import: ${specifier}`);
      }
    }
  }
});
