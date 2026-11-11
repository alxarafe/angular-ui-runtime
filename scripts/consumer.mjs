import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const consumer = mkdtempSync(join(tmpdir(), 'aur-consumer-'));
const run = (command, args) => execFileSync(command, args, { cwd: consumer, stdio: 'inherit' });
try {
  cpSync('tests/consumer', consumer, { recursive: true });
  cpSync('/artifacts/alxarafe-ui-runtime-0.1.0.tgz', join(consumer, 'runtime.tgz'));
  run('npm', ['ci', '--no-audit', '--no-fund']);
  run('npm', ['install', '--no-save', '--package-lock=false', '--no-audit', '--no-fund', './runtime.tgz']);
  const installed = realpathSync(join(consumer, 'node_modules/@alxarafe/ui-runtime'));
  assert(installed.startsWith(`${consumer}/node_modules/`), 'Package must be installed, not linked to repository sources');
  run('node', ['--input-type=module', '-e', "import assert from 'node:assert/strict'; import { UI_RUNTIME_VERSION } from '@alxarafe/ui-runtime'; assert.equal(UI_RUNTIME_VERSION, '0.1.0');"]);
  run(join(consumer, 'node_modules/.bin/ng'), ['build', 'consumer']);
  const output = join(consumer, 'dist/browser');
  const scripts = readdirSync(output).filter((name) => name.endsWith('.js'));
  assert(scripts.some((name) => readFileSync(join(output, name), 'utf8').includes('0.1.0')), 'Public export must reach the consumer bundle');
  console.log('CONSUMER PASS: isolated tarball install, public ESM import, declarations and standalone Angular production build');
} finally {
  rmSync(consumer, { recursive: true, force: true });
}
