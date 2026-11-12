import { readFileSync, writeFileSync } from 'node:fs';
import { buildTheme, THEME_IDS } from './theme-package.mjs';

const selected = process.argv[2] ?? 'all';
for (const id of selected === 'all' ? THEME_IDS : [selected]) await buildTheme(id, process.argv[3]);
if (selected === 'all') writeFileSync('/artifacts/theme-packages-build.json', JSON.stringify({
  packages: THEME_IDS.map(id => JSON.parse(readFileSync(`/artifacts/theme-${id}-build.json`, 'utf8'))),
  visualApproval: 'pending human review',
}, null, 2));
