import assert from 'node:assert/strict';
import test from 'node:test';
import { Injector } from '@angular/core';
import { composeForm, formPathKey, ThemeRegistry, ThemeResolver, ThemeService, provideThemeRuntime, THEME_ARTIFACTS } from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
import { DEFAULT_THEME, MissingInputProbe, NonStandaloneProbe, FieldProbe } from '../out-tsc/tests/tests/fixtures/theme-components.js';
import { DefaultFrame, AlternateFrame, InvalidFrame } from '../out-tsc/tests/tests/fixtures/form-components.js';
const path = name => [{ kind: 'property', name }];
const field = (id, excluded = false) => ({ id, path: path(id), artifact: 'field.STRING', excluded });
const definition = { id: 'example', label: 'Example', fields: [field('first'), field('exact'), field('excluded', true), field('last')],
  actions: [{ id: 'root', label: 'Root', enabled: true }, { id: 'tab', label: 'Tab', enabled: true }, { id: 'section', label: 'Section', enabled: false }, { id: 'unplaced', label: 'Unplaced', enabled: true }] };
const group = (id, fields) => ({ id, fields });
const section = (id, groups = [], actions = []) => ({ id, groups, actions, collapsible: true, initiallyCollapsed: false });
const tab = (id, sections = [], actions = []) => ({ id, sections, actions });

test('absent and empty layouts provide deterministic eligible field/action fallback without changing values', () => {
  for (const layout of [undefined, { tabs: [], actions: [] }]) {
    const result = composeForm(definition, layout);
    assert.deepEqual(result.unplaced.map(field => field.id), ['first', 'exact', 'last']);
    assert.equal(result.unplaced[1].artifact, 'field.STRING');
    assert.deepEqual(result.actions.map(action => action.id), ['root', 'tab', 'section', 'unplaced']);
    assert.deepEqual(result.diagnostics, []);
    assert(Object.isFrozen(result)); assert(Object.isFrozen(result.unplaced));
  }
});

test('ordered tabs/sections/groups place each field once, diagnose references and keep exclusions absent', () => {
  const layout = { actions: [], tabs: [tab('second', [section('s', [group('g', [path('exact'), path('missing'), path('excluded'), path('exact')])])]), tab('first', [section('other', [group('g', [path('first'), path('exact')])])])] };
  const result = composeForm(definition, layout);
  assert.deepEqual(result.tabs.map(tab => tab.id), ['second', 'first']);
  assert.deepEqual(result.tabs[0].sections[0].groups[0].fields.map(field => field.id), ['exact']);
  assert.deepEqual(result.tabs[1].sections[0].groups[0].fields.map(field => field.id), ['first']);
  assert.deepEqual(result.unplaced.map(field => field.id), ['last']);
  assert.deepEqual(result.diagnostics.map(item => item.code), ['unknown-field', 'excluded-field', 'duplicate-field', 'duplicate-field']);
  assert(Object.isFrozen(result.tabs[0].sections[0].groups[0].fields[0].path[0]));
  assert.equal(definition.fields.length, 4);
});

test('actions use the effective catalogue, preserve root/tab/section order and fall back exactly once', () => {
  const result = composeForm(definition, { actions: [{ id: 'root', enabled: false }], tabs: [
    tab('tab', [section('actions-only', [], [{ id: 'section', enabled: true }, { id: 'missing' }]), section('empty', [group('empty', [])])], [{ id: 'tab' }, { id: 'root' }]),
  ] });
  assert.deepEqual(result.actions.map(action => action.id), ['root', 'unplaced']);
  assert.equal(result.actions[0].enabled, true);
  assert.equal(result.tabs[0].sections[0].actions[0].enabled, false);
  assert.equal(result.tabs[0].sections[0].groups.length, 0);
  assert.equal(result.tabs[0].sections[1].groups[0].fields.length, 0);
  assert.deepEqual(result.diagnostics.map(item => item.code), ['duplicate-action', 'unknown-action']);
});

test('paths distinguish properties, stable rows, dotted names and tuple boundaries', () => {
  const paths = [path('a.b'), [...path('a'), ...path('b')], [...path('a'), { kind: 'row', key: 'b' }]];
  assert.equal(new Set(paths.map(formPathKey)).size, 3);
  const nested = { ...definition, fields: paths.map((path, index) => ({ ...field(`f${index}`), path })) };
  assert.equal(composeForm(nested).unplaced.length, 3);
  for (const invalid of [[], 'a.b', [{ kind: 'row', index: 0 }], [{ kind: 'property', name: '' }]]) assert.throws(() => formPathKey(invalid));
});

test('malformed catalogues, duplicate identities/paths and inconsistent collapse state reject', () => {
  for (const invalid of [
    { ...definition, id: '' }, { ...definition, fields: [field('a'), field('a')] },
    { ...definition, fields: [field('a'), { ...field('b'), path: path('a') }] },
    { ...definition, actions: [definition.actions[0], definition.actions[0]] },
    { ...definition, fields: [{ ...field('a'), artifact: 'shell' }] },
    { ...definition, fields: [{ ...field('a'), excluded: 'yes' }] },
  ]) assert.throws(() => composeForm(invalid));
  for (const tabs of [[tab('a'), tab('a')], [tab('a', [section('s'), section('s')])], [tab('a', [section('s', [group('g', []), group('g', [])])])],
    [tab('a', [{ ...section('s'), collapsible: false, initiallyCollapsed: true }])]]) assert.throws(() => composeForm(definition, { tabs, actions: [] }));
});

test('form presentation integrates with the same registry/resolver without changing base obligations', () => {
  const injector = Injector.create({ providers: provideThemeRuntime([
    DEFAULT_THEME, { id: 'frame', cssClass: 'frame', overrides: {}, components: { form: AlternateFrame } },
  ]) });
  try {
    const resolver = injector.get(ThemeResolver), service = injector.get(ThemeService);
    assert.equal(THEME_ARTIFACTS.length, 20);
    assert.equal(resolver.resolveComponent('form').name, 'DefaultFormPresentation');
    service.activate('frame'); assert.equal(resolver.resolveComponent('form'), AlternateFrame);
    service.activate('unknown'); assert.equal(resolver.resolveComponent('form').name, 'DefaultFormPresentation');
    assert.throws(() => resolver.resolveComponent('grid'), /Unknown/);
  } finally { injector.destroy(); }
  const injector2 = Injector.create({ providers: provideThemeRuntime([{ ...DEFAULT_THEME, components: { form: DefaultFrame } }, { id: 'sparse', cssClass: 'sparse', overrides: {} }]) });
  try { injector2.get(ThemeService).activate('sparse'); assert.equal(injector2.get(ThemeResolver).resolveComponent('form'), DefaultFrame); }
  finally { injector2.destroy(); }
});

test('registration validates form ports/projection and snapshots optional component maps', () => {
  for (const component of [MissingInputProbe, NonStandaloneProbe, FieldProbe, InvalidFrame, class Plain {}])
    assert.throws(() => new ThemeRegistry([{ ...DEFAULT_THEME, components: { form: component } }]), /presentation/);
  assert.throws(() => new ThemeRegistry([{ ...DEFAULT_THEME, components: { unknown: DefaultFrame } }]), /presentation/);
  const components = { form: DefaultFrame };
  const registry = new ThemeRegistry([{ ...DEFAULT_THEME, components }]);
  components.form = AlternateFrame;
  assert.equal(registry.require('default').components.form, DefaultFrame);
  assert(Object.isFrozen(registry.require('default').components));
});

test('renderer contexts are separate from placement definitions and validate binding identity/exact values', async () => {
  const { validateFormContexts } = await import('../out-tsc/tests/projects/ui-runtime/src/form/form-contexts.js');
  const definition = { id: 'separate', label: 'Separate', fields: [field('a'), field('excluded', true), field('b')] };
  const contexts = { a: { id: 'a', label: 'A', value: '9223372036854775807.123456789' }, b: { id: 'b', label: 'B', value: null } };
  validateFormContexts(definition, contexts);
  assert.equal(contexts.a.value, '9223372036854775807.123456789');
  for (const invalid of [
    {}, { ...contexts, b: { ...contexts.b, id: 'a' } }, { ...contexts, a: { ...contexts.a, value: 42 } },
    { ...contexts, a: { ...contexts.a, readOnly: 'yes' } },
  ]) assert.throws(() => validateFormContexts(definition, invalid));
  assert.equal(composeForm(definition).unplaced.length, 2);
});
