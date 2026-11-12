import assert from 'node:assert/strict';
import test from 'node:test';
import {
  THEME_NAVIGATION_BINDINGS, THEME_SHELL_BINDINGS, THEME_SHELL_PROJECTION,
  ThemeRegistry, ThemeArtifact,
} from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
import { structureSelectors } from '../out-tsc/tests/projects/ui-runtime/src/structure/theme-outlets.js';
import {
  ShellPortProbe, NavigationPortProbe, PanelPortProbe, MissingCatchAllProbe,
  UnsupportedSelectorProbe, MissingShellBindingsProbe, InvalidPanelProjectionProbe,
  MissingNavigationOutputProbe,
} from '../out-tsc/tests/tests/fixtures/structure-components.js';
import { DEFAULT_THEME, StructureProbe } from '../out-tsc/tests/tests/fixtures/theme-components.js';

test('compiled structural ports are additive to the legacy registry and twenty-key fallback', () => {
  const registry = new ThemeRegistry([DEFAULT_THEME, {
    id: 'independent', cssClass: 'independent', overrides: {
      [ThemeArtifact.Shell]: ShellPortProbe,
      [ThemeArtifact.Navigation]: NavigationPortProbe,
      [ThemeArtifact.Panel]: PanelPortProbe,
    },
  }]);
  assert.equal(registry.require('default').overrides.shell, StructureProbe);
  assert.equal(registry.require('independent').overrides.shell, ShellPortProbe);
  assert.deepEqual(THEME_SHELL_BINDINGS, { navigation: 'navigation', navigationSelected: 'navigationSelected' });
  assert.deepEqual(THEME_NAVIGATION_BINDINGS, { items: 'items', selected: 'selected' });
  assert(structureSelectors(ShellPortProbe, 'shell').includes(THEME_SHELL_PROJECTION.content));
  assert.deepEqual(structureSelectors(PanelPortProbe, 'panel'), ['*']);
  assert.deepEqual(structureSelectors(NavigationPortProbe, 'navigation'), []);
});

test('opt-in hosts reject missing ports or projections without strengthening legacy admission', () => {
  for (const component of [MissingCatchAllProbe, UnsupportedSelectorProbe])
    assert.throws(() => structureSelectors(component, 'shell'), /projection/);
  assert.throws(() => structureSelectors(MissingShellBindingsProbe, 'shell'), /bindings/);
  assert.throws(() => structureSelectors(MissingNavigationOutputProbe, 'navigation'), /bindings/);
  assert.throws(() => structureSelectors(InvalidPanelProjectionProbe, 'panel'), /projection/);
  assert.throws(() => structureSelectors(class NotCompiled {}, 'shell'), /compiled standalone/);
  assert.doesNotThrow(() => new ThemeRegistry([DEFAULT_THEME]));
});
