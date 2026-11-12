import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { assertConsumerLockPreserved } from './consumer-lock.mjs';

const workspace = mkdtempSync(join(tmpdir(), 'aur-testbed-'));
const destination = '/artifacts/testbed';
const run = (command, args) => execFileSync(command, args, { cwd: workspace, stdio: 'inherit' });
try {
  cpSync('apps/testbed', workspace, { recursive: true });
  const archive = readFileSync('/artifacts/alxarafe-ui-runtime-0.2.0.tgz');
  writeFileSync(join(workspace, 'runtime.tgz'), archive);
  const themeArchive = readFileSync('/artifacts/alxarafe-ui-theme-default-0.0.0-experimental.0.tgz');
  writeFileSync(join(workspace, 'theme.tgz'), themeArchive);
  const lockfile = readFileSync(join(workspace, 'package-lock.json'), 'utf8');
  const locked = JSON.parse(lockfile).packages;
  const tree = () => JSON.parse(readFileSync(join(workspace, 'node_modules/.package-lock.json'), 'utf8')).packages;
  run('npm', ['ci', '--no-audit', '--no-fund']);
  const before = tree();
  run('npm', ['install', '--no-save', '--no-audit', '--no-fund', './runtime.tgz', './theme.tgz']);
  assert.equal(readFileSync(join(workspace, 'package-lock.json'), 'utf8'), lockfile, 'Testbed lockfile must remain unchanged');
  const dependencies = assertConsumerLockPreserved(locked, before, tree(), ['@alxarafe/ui-theme-default']);
  const installed = realpathSync(join(workspace, 'node_modules/@alxarafe/ui-runtime'));
  assert(installed.startsWith(`${workspace}/node_modules/`), 'Testbed must use an installed package, not repository sources');
  const pkg = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'));
  assert.equal(pkg.name, '@alxarafe/ui-runtime');
  assert.equal(pkg.version, '0.2.0');
  const themePath = realpathSync(join(workspace, 'node_modules/@alxarafe/ui-theme-default'));
  assert(themePath.startsWith(`${workspace}/node_modules/`));
  const themePackage = JSON.parse(readFileSync(join(themePath, 'package.json'), 'utf8'));
  assert.equal(themePackage.name, '@alxarafe/ui-theme-default');
  assert.equal(themePackage.version, '0.0.0-experimental.0');
  run('npm', ['run', 'build']);
  mkdirSync(destination, { recursive: true });
  // Replace only this task-owned static site after a successful build.
  rmSync(join(destination, 'site'), { recursive: true, force: true });
  cpSync(join(workspace, 'dist/browser'), join(destination, 'site'), { recursive: true });
  run('npm', ['run', 'build', '--', '--configuration', 'defaultTheme']);
  cpSync(join(workspace, 'dist-default/browser'), join(destination, 'site/default-theme'), { recursive: true });
  writeFileSync(join(destination, 'build-evidence.json'), JSON.stringify({
    package: pkg.name, version: pkg.version, installedFrom: 'file:runtime.tgz',
    archiveSha256: createHash('sha256').update(archive).digest('hex'),
    lockfileSha256: createHash('sha256').update(lockfile).digest('hex'),
    installedPath: installed, preservedDependencies: dependencies,
    node: process.version, visualBaselineApproved: false,
    defaultTheme: { name: themePackage.name, version: themePackage.version,
      archiveSha256: createHash('sha256').update(themeArchive).digest('hex'), installedPath: themePath },
  }, null, 2));
  console.log(`TESTBED BUILD PASS: installed APF package; ${dependencies} locked dependencies preserved`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
