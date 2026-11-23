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

test('artifact field definitions accept the canonical INTEGER artifact and reject obsolete widths', () => {
  const quantity = { id: 'quantity', path: path('quantity'), artifact: 'field.INTEGER' };
  const result = composeForm({ id: 'integers', label: 'Integers', fields: [quantity] });
  assert.deepEqual(result.unplaced.map(field => field.id), ['quantity']);
  assert.equal(result.unplaced[0].artifact, 'field.INTEGER');
  for (const obsolete of ['field.INT8', 'field.UINT8', 'field.INT16', 'field.UINT16', 'field.INT32', 'field.UINT32', 'field.INT64'])
    assert.throws(() => composeForm({ ...definition, fields: [{ ...field('legacy'), artifact: obsolete }] }), /Invalid field artifact/);
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
    assert.equal(THEME_ARTIFACTS.length, 14);
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

test('form renderer definitions discriminate mechanisms and reject ambiguous or malformed metadata', () => {
  const control = { id: 'score', path: path('score'), kind: 'control', controlId: 'rating' };
  assert.equal(composeForm({ ...definition, fields: [control] }).unplaced[0].controlId, 'rating');
  for (const invalid of [
    { ...control, artifact: 'field.STRING' }, { ...control, artifact: undefined }, { ...control, controlId: '' },
    { ...control, kind: 'unknown' }, { ...control, kind: undefined },
    { ...field('legacy'), controlId: 'rating' }, { ...field('legacy'), controlId: undefined },
  ]) assert.throws(() => composeForm({ ...definition, fields: [invalid] }));
  assert.equal(composeForm({ ...definition, fields: [{ ...field('legacy'), kind: 'artifact' }] }).unplaced.length, 1);
});

test('form optional binding uses independent effective requests, exact values and active ordered fallback', async () => {
  const { resolveFormFieldRenderer } = await import('../out-tsc/tests/projects/ui-runtime/src/form/form-field-renderer.js');
  const domain = { semantic: 'qa-form-score', values: [null, '0', '1'] };
  const controls = [{ id: 'score', domain, alternatives: ['numeric'] }, { id: 'numeric', domain }];
  const seen = [];
  const dynamic = { component: FieldProbe, domain, capabilities: request => { seen.push(request); return request.presentation?.stars === 3 ? undefined : request.domain; } };
  const numeric = { component: FieldProbe, domain, capabilities: request => { seen.push(request); return request.domain; } };
  const injector = Injector.create({ providers: provideThemeRuntime([
    { ...DEFAULT_THEME, controls: { score: dynamic, numeric } },
    { id: 'active', cssClass: 'active', overrides: {}, controls: { numeric } },
  ], controls) });
  try {
    const registry = injector.get(ThemeRegistry), resolver = injector.get(ThemeResolver);
    const descriptor = { id: 'score-field', path: path('score'), kind: 'control', controlId: 'score' };
    for (const [values, stars, value] of [
      [[null, '0', '1', '2', '3', '4', '5'], 5, null],
      [['0', '1', '9223372036854775808.000000001'], 10, '9223372036854775808.000000001'],
      [[false, true], 5, false], [[null, '', '0'], 5, ''],
    ]) {
      const context = { id: 'native-score', label: 'Score', value, control: { domain: { semantic: domain.semantic, values }, presentation: { stars } } };
      const binding = resolveFormFieldRenderer(descriptor, context, registry, resolver);
      assert.equal(binding.component, FieldProbe);
      assert.equal(binding.context.value, value);
      assert.deepEqual(binding.context.control, seen.at(-1));
      assert(Object.isFrozen(binding.context.control.domain.values));
      assert.deepEqual(context.control.domain.values, values);
    }
    const legacyRequest = resolveFormFieldRenderer(descriptor, { id: 'score', label: 'Score', value: '1' }, registry, resolver);
    assert.deepEqual(legacyRequest.context.control, { domain });
    injector.get(ThemeService).activate('active');
    const request = { domain, presentation: { stars: 5 } };
    assert.equal(resolver.resolveControl('score', request).theme, 'active');
    assert.equal(resolver.resolveControl('score', request).control, 'numeric');
    const binding = resolveFormFieldRenderer(descriptor, { id: 'score', label: 'Score', value: '1', control: request }, registry, resolver);
    assert.deepEqual(binding.context.control, seen.at(-1));
    assert.equal(resolver.resolveControl('score', { domain, presentation: { stars: 3 } }).control, 'numeric');
  } finally { injector.destroy(); }
});

test('form optional binding rejects unknown IDs, incompatible semantics and unrepresentable requests without artifact substitution', async () => {
  const { resolveFormFieldRenderer } = await import('../out-tsc/tests/projects/ui-runtime/src/form/form-field-renderer.js');
  const domain = { semantic: 'score', values: ['0', '1'] };
  const injector = Injector.create({ providers: provideThemeRuntime([{ ...DEFAULT_THEME, controls: {
    score: { component: FieldProbe, domain },
  } }], [{ id: 'score', domain }]) });
  try {
    const registry = injector.get(ThemeRegistry), resolver = injector.get(ThemeResolver);
    const descriptor = { id: 'score-field', path: path('score'), kind: 'control', controlId: 'score' };
    const context = { id: 'score', label: 'Score', value: '0' };
    for (const [field, control, pattern] of [
      [{ ...descriptor, controlId: 'unknown' }, undefined, /Unknown optional/],
      [descriptor, { domain: { ...domain, semantic: 'different' } }, /semantics/],
      [descriptor, { domain: { ...domain, values: [null, '0', '1'] } }, /No compatible/],
      [descriptor, { domain, presentation: { unsupported: true } }, /No compatible/],
    ]) assert.throws(() => resolveFormFieldRenderer(field, { ...context, control }, registry, resolver), pattern);
    const legacyContext = { id: 'text', label: 'Text', value: '9223372036854775807.000000001' };
    const legacy = resolveFormFieldRenderer(field('text'), legacyContext, registry, resolver);
    assert.equal(legacy.context, legacyContext);
    assert.equal(legacy.component, resolver.resolve('field.STRING'));
  } finally { injector.destroy(); }
});

test('programmatic diagnostics retain protected reference identity and frozen paths without placing it', () => {
  const secret = 'private-path-token';
  const hidden = { ...field('private-field-token', true), path: path(secret) };
  const result = composeForm({ ...definition, fields: [field('visible'), hidden] }, {
    actions: [{ id: 'private-action-token' }], tabs: [tab('tab', [section('section', [group('group', [path(secret)])])])],
  });
  assert.deepEqual(result.unplaced.map(field => field.id), ['visible']);
  assert.deepEqual(result.diagnostics.map(item => item.code), ['unknown-action', 'excluded-field']);
  assert.equal(result.diagnostics[0].id, 'private-action-token');
  assert.equal(result.diagnostics[1].path[0].name, secret);
  assert(Object.isFrozen(result.diagnostics));
  assert(Object.isFrozen(result.diagnostics[1].path[0]));
});
