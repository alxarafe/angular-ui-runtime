import assert from 'node:assert/strict';
import test from 'node:test';
import { runtimePackage, themePackage } from '../scripts/package-metadata.mjs';
import { assertConsumerLockPreserved } from '../scripts/consumer-lock.mjs';

const path = 'node_modules/@babel/parser';
const entry = { version: '8.1.0', resolved: 'https://registry.npmjs.org/@babel/parser/-/parser-8.1.0.tgz', integrity: 'sha512-locked' };
const before = { [path]: entry };
const locked = { ...before, 'node_modules/optional-other-platform': { version: '1.0.0', optional: true } };
const after = { ...before, 'node_modules/@alxarafe/ui-runtime': { version: runtimePackage.version, resolved: 'file:runtime.tgz' } };

test('consumer lock permits the tarball addition and absent platform-specific optional packages', () => {
  assert.equal(assertConsumerLockPreserved(locked, before, after), 1);
});

test('consumer lock rejects the Babel version drift observed in AUR-INFRA-001', () => {
  assert.throws(() => assertConsumerLockPreserved(locked, before, {
    ...after, [path]: { ...entry, version: '8.1.2' },
  }), /version changed during tarball installation/);
});

test('consumer lock rejects source or integrity substitution even at the same version', () => {
  for (const key of ['resolved', 'integrity']) {
    assert.throws(() => assertConsumerLockPreserved(locked, before, {
      ...after, [path]: { ...entry, [key]: 'substituted' },
    }), new RegExp(`${key} changed during tarball installation`));
  }
});

test('consumer lock rejects missing dependencies and unexpected additions', () => {
  const { [path]: removed, ...missing } = after;
  assert.throws(() => assertConsumerLockPreserved(locked, before, missing), /dependency was removed/);
  assert.throws(() => assertConsumerLockPreserved(locked, before, {
    ...after, 'node_modules/unexpected': { version: '1.0.0' },
  }), /Unexpected consumer dependency added/);
});

test('consumer lock rejects an unlocked or already drifted initial snapshot', () => {
  assert.throws(() => assertConsumerLockPreserved({}, before, after), /dependency is not locked/);
  assert.throws(() => assertConsumerLockPreserved(locked, {
    [path]: { ...entry, version: '8.1.2' },
  }, after), /Initial consumer .* version differs from lockfile/);
  assert.throws(() => assertConsumerLockPreserved(locked, {}, after), /snapshot must not be empty/);
});

test('consumer lock requires a newly installed runtime', () => {
  assert.throws(() => assertConsumerLockPreserved(locked, before, before), /runtime package must be installed/);
  assert.throws(() => assertConsumerLockPreserved(locked, after, after), /Runtime must be installed from the generated tarball/);
});

test('a separately packed theme is allowed only when explicitly requested and newly installed', () => {
  const theme = 'node_modules/@alxarafe/ui-theme-default';
  const both = { ...after, [theme]: { version: themePackage('default').version } };
  assert.throws(() => assertConsumerLockPreserved(locked, before, both), /Unexpected consumer dependency/);
  assert.equal(assertConsumerLockPreserved(locked, before, both, ['@alxarafe/ui-theme-default']), 1);
  assert.throws(() => assertConsumerLockPreserved(locked, before, after, ['@alxarafe/ui-theme-default']), /archive package must be installed/);
});
