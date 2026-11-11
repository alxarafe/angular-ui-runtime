/** SPDX-License-Identifier: Apache-2.0
 * Adapted from alxarafe/erbas-client theme-runtime.spec.ts; see NOTICE.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { Injector, runInInjectionContext } from '@angular/core';
import {
  ThemeArtifact, ThemeId, THEME_ARTIFACTS, ThemeRegistry, ThemeService,
  ThemeResolver, provideThemeRuntime, FIELD_RENDERER_BINDINGS,
} from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
import {
  StructureProbe, OverrideProbe, NonStandaloneProbe, FieldProbe,
  MissingInputProbe, MissingOutputProbe, AliasedFieldProbe,
  DEFAULT_ARTIFACTS, DEFAULT_THEME, EXACT_CONTEXT,
} from '../out-tsc/tests/tests/fixtures/theme-components.js';

const CSS_ONLY = { id: 'css-only', cssClass: 'theme-css-only', overrides: {} };
const OVERLAY = { id: 'overlay', cssClass: 'theme-overlay', overrides: { [ThemeArtifact.Panel]: OverrideProbe } };
const setup = () => Injector.create({ providers: provideThemeRuntime([DEFAULT_THEME, CSS_ONLY, OVERLAY]) });

test('registration captures immutable sorted snapshots and exposes only generic default identity', () => {
  const source = { ...OVERLAY, overrides: { ...OVERLAY.overrides } };
  const registry = new ThemeRegistry([source, DEFAULT_THEME, CSS_ONLY]);
  source.overrides[ThemeArtifact.Panel] = StructureProbe;
  source.cssClass = 'changed';
  assert.deepEqual(ThemeId, { Default: 'default' });
  assert.deepEqual(registry.all.map(({ id }) => id), ['css-only', 'default', 'overlay']);
  assert.equal(registry.require('overlay').overrides[ThemeArtifact.Panel], OverrideProbe);
  assert.equal(registry.require('overlay').cssClass, 'theme-overlay');
  assert(Object.isFrozen(registry.all));
  assert(Object.isFrozen(registry.require('overlay')));
  assert(Object.isFrozen(registry.require('overlay').overrides));
  assert.equal(registry.find('absent'), undefined);
  assert.throws(() => registry.require('absent'), /Unknown theme/);
});

test('switching resolves sparse overrides, all default artifacts and CSS-only themes in one fallback hop', () => {
  const injector = setup();
  try {
    const service = injector.get(ThemeService);
    const resolver = injector.get(ThemeResolver);
    assert.equal(service.current().id, 'default');
    for (const artifact of THEME_ARTIFACTS) assert.equal(resolver.resolve(artifact), DEFAULT_ARTIFACTS[artifact]);
    assert.equal(service.activate('overlay'), true);
    for (const artifact of THEME_ARTIFACTS)
      assert.equal(resolver.resolve(artifact), OVERLAY.overrides[artifact] ?? DEFAULT_ARTIFACTS[artifact]);
    assert.equal(service.activate(CSS_ONLY.id), true);
    assert.equal(service.current().cssClass, CSS_ONLY.cssClass);
    for (const artifact of THEME_ARTIFACTS) assert.equal(resolver.resolve(artifact), DEFAULT_ARTIFACTS[artifact]);
    assert.equal(service.activate('overlay'), true);
    assert.equal(service.activate('unknown'), false);
    assert.equal(service.current().id, 'default');
    assert.equal(resolver.resolve(ThemeArtifact.Panel), StructureProbe);
    assert.throws(() => resolver.resolve('invalid'), /Unknown theme artifact/);
  } finally { injector.destroy(); }
});

test('provider compositions keep theme selection isolated', () => {
  const first = setup();
  const second = setup();
  try {
    first.get(ThemeService).activate('overlay');
    assert.equal(second.get(ThemeService).current().id, 'default');
    assert.equal(first.get(ThemeResolver).resolve(ThemeArtifact.Panel), OverrideProbe);
    assert.equal(second.get(ThemeResolver).resolve(ThemeArtifact.Panel), StructureProbe);
  } finally { first.destroy(); second.destroy(); }
});

for (const artifact of THEME_ARTIFACTS) {
  test(`default theme must provide ${artifact}`, () => {
    const overrides = { ...DEFAULT_ARTIFACTS };
    delete overrides[artifact];
    assert.throws(() => new ThemeRegistry([{ ...DEFAULT_THEME, overrides }]), /every artifact/);
  });
}

test('rejects missing defaults, duplicate and malformed identities', () => {
  assert.throws(() => new ThemeRegistry([]), /every artifact/);
  assert.throws(() => new ThemeRegistry([CSS_ONLY]), /every artifact/);
  assert.throws(() => new ThemeRegistry([DEFAULT_THEME, DEFAULT_THEME]), /duplicate/);
  for (const identity of ['', 'Upper', 'has space', '9numeric', 'with.dot']) {
    for (const key of ['id', 'cssClass'])
      assert.throws(() => new ThemeRegistry([DEFAULT_THEME, { ...CSS_ONLY, [key]: identity }]), /identity/);
  }
});

test('rejects unknown artifacts, non-components, non-standalone components and invalid field bindings', () => {
  const reject = (overrides, pattern) => assert.throws(
    () => new ThemeRegistry([DEFAULT_THEME, { ...CSS_ONLY, overrides }]), pattern,
  );
  reject({ unknown: StructureProbe }, /Unknown or invalid/);
  for (const value of [undefined, null, {}, 'component', 42]) reject({ shell: value }, /Unknown or invalid/);
  for (const component of [class NotAComponent {}, NonStandaloneProbe]) reject({ shell: component }, /compiled standalone/);
  for (const component of [StructureProbe, MissingInputProbe, MissingOutputProbe, AliasedFieldProbe])
    reject({ [ThemeArtifact.FieldString]: component }, /renderer contract/);
});

test('renderer contract preserves exact strings, booleans, null and context without coercion', () => {
  assert.deepEqual(FIELD_RENDERER_BINDINGS, { context: 'context', valueChange: 'valueChange' });
  const injector = setup();
  try {
    const renderer = runInInjectionContext(injector, () => new FieldProbe());
    assert.equal(renderer.context(), EXACT_CONTEXT);
    const received = [];
    const subscription = renderer.valueChange.subscribe((value) => received.push(value));
    const values = [EXACT_CONTEXT.value, '9223372036854775807', '2026-11-11', '12:34:56.123456',
      '2026-11-11T12:34:56.123456Z', 'AAECA/8=', true, false, null];
    for (const value of values) renderer.valueChange.emit(value);
    assert.deepEqual(received, values);
    assert.equal(EXACT_CONTEXT.disabled, true);
    assert.equal(EXACT_CONTEXT.readOnly, true);
    assert.deepEqual(EXACT_CONTEXT.choices, [EXACT_CONTEXT.value]);
    subscription.unsubscribe();
  } finally { injector.destroy(); }
});
