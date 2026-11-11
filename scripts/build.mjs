import { execFileSync } from 'node:child_process';
import { copyFileSync, rmSync } from 'node:fs';

// ng-packagr only accepts assets within the library root. Stage the canonical
// repository documentation inside the disposable workspace, then remove it.
const assets = ['README.md', 'LICENSE'];
try {
  for (const name of assets) copyFileSync(name, `projects/ui-runtime/${name}`);
  execFileSync('node_modules/.bin/ng', ['build', 'ui-runtime', '--configuration', 'production'], { stdio: 'inherit' });
} finally {
  for (const name of assets) rmSync(`projects/ui-runtime/${name}`, { force: true });
}
