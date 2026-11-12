import '@angular/compiler';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assertConsumerLockPreserved } from './consumer-lock.mjs';

// Build from a copied theme and an installed runtime archive, never workspace source aliases.
const workspace = mkdtempSync(join(tmpdir(), 'aur-theme-default-'));
const destination = '/artifacts';
const runtimeArchive = resolve(process.argv[2] ?? `${destination}/alxarafe-ui-runtime-0.2.0.tgz`);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (command, args, cwd = workspace) => execFileSync(command, args, { cwd, stdio: 'inherit' });
try {
  cpSync('packages/themes/default', join(workspace, 'theme'), { recursive: true });
  for (const file of ['package.json', 'package-lock.json']) cpSync(file, join(workspace, file));
  const lock = readFileSync(join(workspace, 'package-lock.json'), 'utf8');
  const locked = JSON.parse(lock).packages;
  const tree = () => JSON.parse(readFileSync(join(workspace, 'node_modules/.package-lock.json'), 'utf8')).packages;
  run('npm', ['ci', '--no-audit', '--no-fund']);
  const before = tree();
  cpSync(runtimeArchive, join(workspace, 'runtime.tgz'));
  run('npm', ['install', '--no-save', '--no-audit', '--no-fund', './runtime.tgz']);
  assert.equal(readFileSync(join(workspace, 'package-lock.json'), 'utf8'), lock);
  const preserved = assertConsumerLockPreserved(locked, before, tree());
  const runtimeRoot = join(workspace, 'node_modules/@alxarafe/ui-runtime');
  const runtimePkg = JSON.parse(readFileSync(join(runtimeRoot, 'package.json'), 'utf8'));
  const runtime = await import(join(runtimeRoot, runtimePkg.exports['.'].default));
  for (const name of ['ThemeShellOutlet', 'ThemeNavigationOutlet', 'ThemePanelOutlet', 'ThemeRegistry'])
    assert(runtime[name], `Runtime archive lacks required public export ${name}; old 0.2.0 is unsupported`);
  const themeRoot = join(workspace, 'theme');
  const inputs = readdirSync('packages/themes/default', { recursive: true }).sort().filter(file => /\.(ts|mjs|html|css|json|md)$|^(LICENSE|NOTICE)$/.test(file));
  const sourceSha256 = sha(inputs.map(file => `${file}\0${sha(readFileSync(join('packages/themes/default', file)))}`).join('\n'));
  const evidence = {
    task: 'AUR-THEME-EXTRACT-001', sourceCommit: process.env.AUR_SOURCE_COMMIT,
    sourceStatus: process.env.AUR_SOURCE_STATUS, themeSourceSha256: sourceSha256,
    runtime: { name: runtimePkg.name, version: runtimePkg.version, archiveSha256: sha(readFileSync(runtimeArchive)),
      requiredPortsRevision: '23e3bf40bf4c3dbad034d3deb71b3358075f51b3' },
    toolchainLockSha256: sha(lock), preservedDependencies: preserved,
    commands: ['./bin/test', './bin/check', './bin/theme-default'],
    unitEvidence: 'tests/default.test.mjs executed before APF packaging',
    browserEvidence: 'artifacts/testbed/default-theme/', visualApproval: 'pending human review',
    distribution: 'private experimental package; coordinated runtime/theme versioning required before external distribution',
  };
  writeFileSync(join(themeRoot, 'conformance.json'), JSON.stringify(evidence, null, 2));
  run(join(workspace, 'node_modules/.bin/ngc'), ['-p', 'tsconfig.test.json'], themeRoot);
  run('node', ['--import', '@angular/compiler', '--test', 'tests/default.test.mjs'], themeRoot);
  run(join(workspace, 'node_modules/.bin/ng-packagr'), ['-p', 'ng-package.json', '-c', 'tsconfig.lib.json'], themeRoot);
  mkdirSync(destination, { recursive: true });
  const [result] = JSON.parse(execFileSync('npm', ['pack', join(workspace, 'dist'), '--json', '--pack-destination', destination], { encoding: 'utf8' }));
  assert.equal(result.name, '@alxarafe/ui-theme-default');
  const paths = result.files.map(file => file.path);
  for (const file of ['LICENSE', 'NOTICE', 'README.md', 'PROVENANCE.json', 'theme.css', 'theme-package.json', 'conformance.json'])
    assert(paths.includes(file), `Theme package missing ${file}`);
  assert(!paths.some(path => /(^|\/)(tests|src|out-tests|node_modules|apps|scripts)\//.test(path)));
  const manifest = JSON.parse(readFileSync(join(workspace, 'dist/package.json'), 'utf8'));
  assert.deepEqual(manifest.peerDependencies, { '@angular/core': '^22.0.0', '@alxarafe/ui-runtime': '0.2.0' });
  assert.deepEqual(Object.keys(manifest.dependencies), ['tslib']);
  assert.equal(manifest.private, true);
  for (const condition of ['types', 'default']) assert(manifest.exports['.'][condition]);
  assert(paths.some(path => path.endsWith('.d.ts')));
  const bundle = readFileSync(join(workspace, 'dist', manifest.exports['.'].default), 'utf8');
  const imports = [...bundle.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]);
  assert(imports.every(name => ['@angular/core', '@alxarafe/ui-runtime'].includes(name)), `Unexpected theme imports: ${imports}`);
  const archive = join(destination, result.filename);
  writeFileSync(join(destination, 'theme-default-build.json'), JSON.stringify({ ...evidence,
    theme: { name: result.name, version: result.version, archive: result.filename, archiveSha256: sha(readFileSync(archive)), files: paths },
  }, null, 2));
  console.log(`THEME DEFAULT PASS: independent APF build, tests, pack and public dependencies: ${archive}`);
} finally {
  rmSync(workspace, { recursive: true, force: true });
}
