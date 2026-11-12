import assert from 'node:assert/strict';
import test from 'node:test';
import { Injector, runInInjectionContext, reflectComponentType } from '@angular/core';
import { ThemeRegistry, THEME_ARTIFACTS, provideThemeRuntime, ThemeResolver, ThemeService } from '@alxarafe/ui-runtime';
import { DEFAULT_THEME, DEFAULT_ARTIFACTS, DefaultEnumRenderer, DefaultNumberRenderer } from '../out-tests/src/public-api.js';

test('independent compiled default is complete and backs sparse and unknown selection', () => {
  assert.equal(new ThemeRegistry([DEFAULT_THEME]).all.length, 1);
  assert.deepEqual(Object.keys(DEFAULT_ARTIFACTS).sort(), [...THEME_ARTIFACTS].sort());
  const injector = Injector.create({ providers: provideThemeRuntime([DEFAULT_THEME, { id: 'empty', cssClass: 'empty', overrides: {} }]) });
  try {
    const service = injector.get(ThemeService), resolver = injector.get(ThemeResolver);
    service.activate('empty');
    for (const artifact of THEME_ARTIFACTS) {
      assert.equal(resolver.resolve(artifact), DEFAULT_ARTIFACTS[artifact]);
      const mirror = reflectComponentType(resolver.resolve(artifact));
      assert(mirror.isStandalone);
      if (artifact.startsWith('field.')) {
        assert(mirror.inputs.some(input => input.templateName === 'context'));
        assert(mirror.outputs.some(output => output.templateName === 'valueChange'));
      }
    }
    assert.equal(service.activate('missing'), false);
    assert.equal(service.current().id, 'default');
  } finally { injector.destroy(); }
});

test('ENUM distinguishes null, empty and sentinel-looking strings and rejects invalid indexes', () => {
  const injector = Injector.create({ providers: [] });
  try {
    const renderer = runInInjectionContext(injector, () => new DefaultEnumRenderer());
    // Unit seam for method semantics; real Angular context bindings are tested in Chromium.
    const context = { id: 'enum', label: 'Enum', value: null, choices: ['', 'Not set', '0'] };
    Object.defineProperty(renderer, 'context', { value: () => context });
    const received = [];
    renderer.valueChange.subscribe(value => received.push(value));
    for (const index of [0, 1, 2, 3, -1, 50]) renderer.selectIndex(index);
    assert.deepEqual(received, [null, '', 'Not set', '0']);
    context.disabled = true;
    renderer.selectIndex(1);
    context.disabled = false;
    context.readOnly = true;
    renderer.selectIndex(1);
    assert.equal(received.length, 4);
  } finally { injector.destroy(); }
});

test('numeric emit keeps exact strings and null without numeric coercion', () => {
  const injector = Injector.create({ providers: [] });
  try {
    const renderer = runInInjectionContext(injector, () => new DefaultNumberRenderer());
    Object.defineProperty(renderer, 'context', { value: () => ({ id: 'n', label: 'Number', value: null }) });
    const received = [];
    renderer.valueChange.subscribe(value => received.push(value));
    for (const value of ['-9223372036854775808', '9007199254740993.123456789', null]) renderer.update(value);
    assert.deepEqual(received, ['-9223372036854775808', '9007199254740993.123456789', null]);
  } finally { injector.destroy(); }
});
