import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const consumer = mkdtempSync(join(tmpdir(), 'aur-consumer-'));
const run = (command, args) => execFileSync(command, args, { cwd: consumer, stdio: 'inherit' });
try {
  cpSync('tests/consumer', consumer, { recursive: true });
  cpSync('/artifacts/alxarafe-ui-runtime-0.2.0.tgz', join(consumer, 'runtime.tgz'));
  run('npm', ['ci', '--no-audit', '--no-fund']);
  run('npm', ['install', '--no-save', '--package-lock=false', '--no-audit', '--no-fund', './runtime.tgz']);
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
