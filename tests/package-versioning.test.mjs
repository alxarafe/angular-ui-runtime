import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { THEME_IDS, runtimePackage, themePackage, archiveName } from '../scripts/package-metadata.mjs';

const json = path => JSON.parse(readFileSync(path, 'utf8'));
test('private package metadata and exact prerelease compatibility agree', () => {
  const workspace = json('package.json');
  const lock = json('package-lock.json');
  assert.equal(workspace.version, runtimePackage.version);
  assert.equal(lock.version, runtimePackage.version);
  assert.equal(lock.packages[''].version, runtimePackage.version);
  assert.equal(runtimePackage.private, true);
  assert.match(runtimePackage.version, /^\d+\.\d+\.\d+-alpha\.\d+$/);
  assert.notEqual(runtimePackage.version, '0.2.0');
  for (const id of THEME_IDS) {
    const pkg = themePackage(id);
    const manifest = json(`packages/themes/${id}/theme-package.json`);
    assert.equal(pkg.private, true);
    assert.equal(pkg.peerDependencies[runtimePackage.name], runtimePackage.version);
    assert.equal(manifest.compatibility.uiRuntime, runtimePackage.version);
    assert.equal(manifest.version, pkg.version);
    assert.equal(manifest.package, pkg.name);
    assert.equal(manifest.compatibility.runtimeSnapshotOnly, undefined);
    assert.equal(manifest.compatibility.requiredRuntimeRevision, undefined);
  }
});
test('archive naming permits independent theme version increments', () => {
  const pkg = themePackage('vintage');
  assert.equal(archiveName({ ...pkg, version: '0.1.1-alpha.2' }), 'alxarafe-ui-theme-vintage-0.1.1-alpha.2.tgz');
  assert.throws(() => themePackage('unreviewed'));
});
