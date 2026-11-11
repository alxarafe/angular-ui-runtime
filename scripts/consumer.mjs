import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertConsumerLockPreserved } from './consumer-lock.mjs';

const consumer = mkdtempSync(join(tmpdir(), 'aur-consumer-'));
const run = (command, args) => execFileSync(command, args, { cwd: consumer, stdio: 'inherit' });
try {
  cpSync('tests/consumer', consumer, { recursive: true });
  cpSync('/artifacts/alxarafe-ui-runtime-0.2.0.tgz', join(consumer, 'runtime.tgz'));
  const lockfile = readFileSync(join(consumer, 'package-lock.json'), 'utf8');
  const locked = JSON.parse(lockfile).packages;
  run('npm', ['ci', '--no-audit', '--no-fund']);
  const tree = () => JSON.parse(readFileSync(join(consumer, 'node_modules/.package-lock.json'), 'utf8')).packages;
  const before = tree();
  run('npm', ['install', '--no-save', '--no-audit', '--no-fund', './runtime.tgz']);
  assert.equal(readFileSync(join(consumer, 'package-lock.json'), 'utf8'), lockfile, 'Consumer lockfile must remain unchanged');
  const count = assertConsumerLockPreserved(locked, before, tree());
  for (const path of Object.keys(before)) {
    const manifest = JSON.parse(readFileSync(join(consumer, path, 'package.json'), 'utf8'));
    assert.equal(manifest.version, locked[path].version, `Installed consumer version differs from lockfile: ${path}`);
  }
  console.log(`CONSUMER LOCK PASS: ${count} installed dependencies retain locked versions, sources and integrity; only the runtime was added`);
  const installed = realpathSync(join(consumer, 'node_modules/@alxarafe/ui-runtime'));
  assert(installed.startsWith(`${consumer}/node_modules/`), 'Package must be installed, not linked to repository sources');
  run('node', ['--import', '@angular/compiler', '--input-type=module', '-e', "import assert from 'node:assert/strict'; import * as api from '@alxarafe/ui-runtime'; assert.equal(api.UI_RUNTIME_VERSION, '0.2.0'); assert.deepEqual(api.ThemeId, { Default: 'default' }); for (const name of ['ThemeArtifact', 'THEME_ARTIFACTS', 'ThemeRegistry', 'ThemeService', 'ThemeResolver', 'provideThemeRuntime', 'FIELD_RENDERER_BINDINGS']) assert.ok(api[name], name); assert.throws(() => new api.ThemeRegistry([]), /every artifact/);"]);
  run(join(consumer, 'node_modules/.bin/ng'), ['build', 'consumer']);
  const output = join(consumer, 'dist/browser');
  const scripts = readdirSync(output).filter((name) => name.endsWith('.js'));
  assert(scripts.some((name) => readFileSync(join(output, name), 'utf8').includes('0.2.0')), 'Public export must reach the consumer bundle');
  console.log('CONSUMER PASS: isolated tarball install, public ESM import, declarations and standalone Angular production build');
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
