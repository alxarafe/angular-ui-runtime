import assert from 'node:assert/strict';

const runtimePath = 'node_modules/@alxarafe/ui-runtime';

// Compare only installed entries: platform-specific optional packages may be absent.
export function assertConsumerLockPreserved(locked, before, after) {
  const paths = Object.keys(before);
  assert(paths.length > 0, 'Consumer dependency snapshot must not be empty');
  assert(!before[runtimePath], 'Runtime must be installed from the generated tarball');
  for (const path of paths) {
    assert(locked[path], `Consumer dependency is not locked: ${path}`);
    assert(after[path], `Consumer dependency was removed: ${path}`);
    for (const key of ['version', 'resolved', 'integrity']) {
      assert.equal(before[path][key], locked[path][key], `Initial consumer ${path}: ${key} differs from lockfile`);
      assert.equal(after[path][key], locked[path][key], `Consumer ${path}: ${key} changed during tarball installation`);
    }
  }
  for (const path of Object.keys(after)) {
    assert(before[path] || path === runtimePath, `Unexpected consumer dependency added: ${path}`);
  }
  assert(after[runtimePath], 'Generated runtime package must be installed');
  return paths.length;
}
