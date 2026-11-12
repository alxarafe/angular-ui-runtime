import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { THEME_IDS, runtimePackage, themePackage, archivePath } from './package-metadata.mjs';
import { assertConsumerLockPreserved } from './consumer-lock.mjs';

const destination = '/artifacts/compatibility';
mkdirSync(destination, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const results = [];
const historical = 'tests/fixtures/historical-runtime/runtime-0.2.0.tgz';
const historicalDigest = '50c5896a6317a5f276190211da16f99540dc7753e84c540af82a55d49a475ed5';
assert.equal(sha(readFileSync(historical)), historicalDigest);
const scenarios = [['default'], ...THEME_IDS.slice(1).map(id => ['default', id]), THEME_IDS];
for (const ids of scenarios) {
  const workspace = mkdtempSync(join(tmpdir(), 'aur-compatibility-'));
  const run = (command, args) => execFileSync(command, args, { cwd: workspace, stdio: 'inherit' });
  try {
    cpSync('tests/consumer', workspace, { recursive: true });
    const lock = readFileSync(join(workspace, 'package-lock.json'), 'utf8');
    run('npm', ['ci', '--no-audit', '--no-fund']);
    const tree = () => JSON.parse(readFileSync(join(workspace, 'node_modules/.package-lock.json'), 'utf8')).packages;
    const before = tree();
    const packages = [runtimePackage, ...ids.map(themePackage)];
    const archives = packages.map((pkg, index) => {
      const file = `package-${index}.tgz`;
      cpSync(archivePath(pkg), join(workspace, file));
      return `./${file}`;
    });
    run('npm', ['install', '--no-save', '--strict-peer-deps', '--no-audit', '--no-fund', ...archives]);
    assert.equal(readFileSync(join(workspace, 'package-lock.json'), 'utf8'), lock);
    const count = assertConsumerLockPreserved(JSON.parse(lock).packages, before, tree(), ids.map(id => themePackage(id).name));
    for (const pkg of packages) {
      const installed = JSON.parse(readFileSync(join(workspace, 'node_modules', pkg.name, 'package.json'), 'utf8'));
      assert.equal(installed.version, pkg.version);
      assert.equal(installed.private, true);
      assert(!Object.keys(installed.dependencies ?? {}).some(name => name.startsWith('@alxarafe/')), 'No transitive runtime/theme dependencies');
    }
    const definitions = ids.map(id => JSON.parse(readFileSync(`packages/themes/${id}/theme-package.json`)).themes[0].definitionExport);
    const imports = ids.map((id, index) => `import { ${definitions[index]} } from '${themePackage(id).name}';`).join('\n');
    run('node', ['--import', '@angular/compiler', '--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { createRequire } from 'node:module';
      import { Injector } from '@angular/core';
      import { ThemeRegistry, ThemeResolver, ThemeService, THEME_ARTIFACTS, provideThemeRuntime } from '@alxarafe/ui-runtime';
      ${imports}
      const themes = [${definitions.join(',')}];
      const injector = Injector.create({providers: provideThemeRuntime(themes)});
      const service = injector.get(ThemeService), resolver = injector.get(ThemeResolver);
      assert.equal(THEME_ARTIFACTS.length, 20);
      for (const theme of themes) {
        assert.equal(service.activate(theme.id), true);
        for (const key of THEME_ARTIFACTS) assert.equal(resolver.resolve(key), theme.overrides[key] ?? DEFAULT_THEME.overrides[key]);
      }
      assert.equal(service.activate('unavailable'), false);
      assert.equal(service.current().id, 'default');
      const require = createRequire(import.meta.url);
      for (const name of ${JSON.stringify(packages.map(pkg => pkg.name))}) {
        const local = createRequire(require.resolve(name));
        assert.equal(local.resolve('@angular/core'), require.resolve('@angular/core'));
        if (name !== '@alxarafe/ui-runtime') {
          assert.equal(local.resolve('@alxarafe/ui-runtime'), require.resolve('@alxarafe/ui-runtime'));
          assert.ok(import.meta.resolve(name + '/theme.css'));
        }
      }
    `]);
    const main = join(workspace, 'src/main.ts');
    writeFileSync(main, imports + '\n' + readFileSync(main, 'utf8').replace(/const defaults: ThemeArtifacts =[\s\S]*?\nbootstrapApplication/, `const themes: readonly ThemeDefinition[] = [${definitions.join(',')}, { id: 'css-only', cssClass: 'theme-css-only', overrides: {} }];\nbootstrapApplication`));
    run(join(workspace, 'node_modules/.bin/ng'), ['build', 'consumer']);
    results.push({ themes: ids, result: 'passed', angularBuild: 'passed', preservedDependencies: count,
      packages: packages.map(pkg => ({ name: pkg.name, version: pkg.version, archiveSha256: sha(readFileSync(archivePath(pkg))) })) });
  } finally { rmSync(workspace, { recursive: true, force: true }); }
}
const rejections = [];
for (const id of THEME_IDS) {
  const workspace = mkdtempSync(join(tmpdir(), 'aur-incompatible-'));
  try {
    cpSync('tests/consumer', workspace, { recursive: true });
    cpSync(historical, join(workspace, 'runtime.tgz'));
    cpSync(archivePath(themePackage(id)), join(workspace, 'theme.tgz'));
    const manifestPath = join(workspace, 'package.json');
    const manifest = JSON.parse(readFileSync(manifestPath));
    manifest.dependencies[runtimePackage.name] = 'file:runtime.tgz';
    manifest.dependencies[themePackage(id).name] = 'file:theme.tgz';
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const result = spawnSync('npm', ['install', '--strict-peer-deps', '--offline', '--no-audit', '--no-fund'], { cwd: workspace, encoding: 'utf8' });
    const log = `${result.stdout}\n${result.stderr}`;
    writeFileSync(join(destination, `rejected-${id}.log`), log);
    assert.notEqual(result.status, 0);
    assert.match(log, /ERESOLVE/);
    assert(log.includes(runtimePackage.version));
    assert.match(log, /0\.2\.0/);
    rejections.push({ theme: id, result: 'ERESOLVE', exitCode: result.status, log: `rejected-${id}.log` });
  } finally { rmSync(workspace, { recursive: true, force: true }); }
}
writeFileSync(join(destination, 'matrix.json'), JSON.stringify({ sourceCommit: process.env.AUR_SOURCE_COMMIT, sourceTreeSha256: process.env.AUR_SOURCE_TREE_SHA256,
  runtimeOnly: 'runtime-only.json', scenarios: results, historicalRuntime: { version: '0.2.0', archiveSha256: historicalDigest }, rejections }, null, 2));
console.log('COMPATIBILITY PASS: six installed Angular consumer combinations; five historical-runtime peer rejections');
