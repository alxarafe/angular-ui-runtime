import '@angular/compiler';
import { reflectComponentType } from '@angular/core';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { assertConsumerLockPreserved } from './consumer-lock.mjs';

import { THEME_IDS, runtimePackage, themePackage, archiveName, archivePath as packageArchivePath } from './package-metadata.mjs';
export { THEME_IDS } from './package-metadata.mjs';
const OVERRIDES = { alternative: ['field.BOOLEAN'], cyberpunk: ['shell', 'panel'], vintage: [], 'high-contrast': ['panel'] };

// Deliberately limited to the five reviewed packages; not a plugin discovery mechanism.
export async function buildTheme(id, archivePath) {
  assert(THEME_IDS.includes(id), `Unknown local theme package: ${id}`);
  const expectedPackage = themePackage(id);
  const sourceRoot = `packages/themes/${id}`;
  const sourceManifest = JSON.parse(readFileSync(`${sourceRoot}/theme-package.json`, 'utf8'));
  // Build from a copied theme and an installed runtime archive, never workspace source aliases.
  const workspace = mkdtempSync(join(tmpdir(), `aur-theme-${id}-`));
  const destination = '/artifacts';
  const runtimeArchive = resolve(archivePath ?? packageArchivePath(runtimePackage, destination));
  const sha = bytes => createHash('sha256').update(bytes).digest('hex');
  const run = (command, args, cwd = workspace) => execFileSync(command, args, { cwd, stdio: 'inherit' });
  try {
    cpSync(sourceRoot, join(workspace, 'theme'), { recursive: true });
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
    assert.equal(runtimePkg.version, expectedPackage.peerDependencies[runtimePackage.name], 'Installed runtime must satisfy the exact prerelease peer');
    const runtime = await import(join(runtimeRoot, runtimePkg.exports['.'].default));
    for (const name of ['ThemeShellOutlet', 'ThemeNavigationOutlet', 'ThemePanelOutlet', 'ThemeRegistry'])
      assert(runtime[name], `Runtime archive lacks required public export ${name}; old 0.2.0 is unsupported`);
    const themeRoot = join(workspace, 'theme');
    const inputs = readdirSync(sourceRoot, { recursive: true }).sort().filter(file => /\.(ts|mjs|html|css|json|md)$|^(LICENSE|NOTICE)$/.test(file));
    const sourceSha256 = sha(inputs.map(file => `${file}\0${sha(readFileSync(join(sourceRoot, file)))}`).join('\n'));
    const evidence = {
      task: id === 'default' ? 'AUR-THEME-EXTRACT-001' : 'AUR-THEME-EXTRACT-002', sourceCommit: process.env.AUR_SOURCE_COMMIT,
      sourceStatus: process.env.AUR_SOURCE_STATUS, sourceTreeSha256: process.env.AUR_SOURCE_TREE_SHA256, themeSourceSha256: sourceSha256,
      provenance: JSON.parse(readFileSync(`${sourceRoot}/PROVENANCE.json`, 'utf8')),
      runtime: { name: runtimePkg.name, version: runtimePkg.version, archiveSha256: sha(readFileSync(runtimeArchive)) },
      toolchainLockSha256: sha(lock), preservedDependencies: preserved,
      commands: ['./bin/test', './bin/check', `./bin/theme-pack ${id}`],
      unitEvidence: 'compiled public definition/ports checks and package-specific unit tests executed before APF packaging',
      browserEvidence: 'artifacts/testbed/optional-themes/', visualApproval: 'pending human review',
      distribution: 'private prerelease; publication prohibited',
    };
    run(join(workspace, 'node_modules/.bin/ngc'), ['-p', 'tsconfig.test.json'], themeRoot);
    const api = await import(join(themeRoot, 'out-tests/src/public-api.js'));
    const definition = api[sourceManifest.themes[0].definitionExport];
    assert.equal(definition.id, id);
    assert.equal(definition.cssClass, sourceManifest.themes[0].cssClass);
    const expected = id === 'default' ? runtime.THEME_ARTIFACTS : OVERRIDES[id];
    assert.deepEqual(Object.keys(definition.overrides).sort(), [...expected].sort());
    assert.deepEqual([...sourceManifest.themes[0].artifacts].sort(), [...expected].sort());
    for (const [key, component] of Object.entries(definition.overrides)) {
      const mirror = reflectComponentType(component);
      assert(mirror?.isStandalone);
      if (key.startsWith('field.')) {
        assert(mirror.inputs.some(input => input.templateName === 'context'));
        assert(mirror.outputs.some(output => output.templateName === 'valueChange'));
      }
    }
    if (id !== 'default') assert.throws(() => new runtime.ThemeRegistry([definition]), /every artifact/);
    if (id === 'cyberpunk') {
      const shell = reflectComponentType(definition.overrides.shell);
      assert(shell.inputs.some(input => input.templateName === 'navigation'));
      assert(shell.outputs.some(output => output.templateName === 'navigationSelected'));
      assert(shell.ngContentSelectors.includes('[aur-shell-content]') && shell.ngContentSelectors.includes('*'));
    }
    if (id === 'cyberpunk' || id === 'high-contrast')
      assert.deepEqual(reflectComponentType(definition.overrides.panel).ngContentSelectors, ['*']);
    const testDirectory = join(themeRoot, 'tests');
    const unitFiles = existsSync(testDirectory) ? readdirSync(testDirectory).filter(file => file.endsWith('.test.mjs')) : [];
    if (unitFiles.length) run('node', ['--import', '@angular/compiler', '--test', ...unitFiles.map(file => `tests/${file}`)], themeRoot);
    evidence.unitEvidence = { compiledDefinitionChecks: 'passed', packageUnitFiles: unitFiles };
    writeFileSync(join(themeRoot, 'conformance.json'), JSON.stringify(evidence, null, 2));
    run(join(workspace, 'node_modules/.bin/ng-packagr'), ['-p', 'ng-package.json', '-c', 'tsconfig.lib.json'], themeRoot);
    mkdirSync(destination, { recursive: true });
    const [result] = JSON.parse(execFileSync('npm', ['pack', join(workspace, 'dist'), '--json', '--pack-destination', destination], { encoding: 'utf8' }));
    assert.equal(result.name, expectedPackage.name);
    assert.equal(result.version, expectedPackage.version);
    assert.equal(result.filename, archiveName(expectedPackage));
    assert.equal(sourceManifest.version, expectedPackage.version);
    assert.equal(sourceManifest.compatibility.uiRuntime, expectedPackage.peerDependencies[runtimePackage.name]);
    const paths = result.files.map(file => file.path);
    for (const file of ['LICENSE', 'NOTICE', 'README.md', 'PROVENANCE.json', 'theme.css', 'theme-package.json', 'conformance.json'])
      assert(paths.includes(file), `Theme package missing ${file}`);
    assert(!paths.some(path => /(^|\/)(tests|src|out-tests|node_modules|apps|scripts)\//.test(path)));
    const manifest = JSON.parse(readFileSync(join(workspace, 'dist/package.json'), 'utf8'));
    assert.deepEqual(manifest.peerDependencies, expectedPackage.peerDependencies);
    assert.deepEqual(Object.keys(manifest.dependencies), ['tslib']);
    assert.equal(manifest.private, true);
    for (const condition of ['types', 'default']) assert(manifest.exports['.'][condition]);
    assert(paths.some(path => path.endsWith('.d.ts')));
    const bundle = readFileSync(join(workspace, 'dist', manifest.exports['.'].default), 'utf8');
    const imports = [...bundle.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]);
    assert(imports.every(name => ['@angular/core', '@alxarafe/ui-runtime'].includes(name)), `Unexpected theme imports: ${imports}`);
    if (id === 'vintage') assert(!bundle.includes('defineComponent') && !bundle.includes('declareComponent'), 'CSS-only Vintage must not contain components');
    const archive = join(destination, result.filename);
    writeFileSync(join(destination, `theme-${id}-build.json`), JSON.stringify({ ...evidence,
      theme: { name: result.name, version: result.version, archive: result.filename, archiveSha256: sha(readFileSync(archive)), files: paths },
    }, null, 2));
    console.log(`THEME ${id} PASS: independent APF build, tests, pack and public dependencies: ${archive}`);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
