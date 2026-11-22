import assert from 'node:assert/strict';
import test from 'node:test';
import { Injector } from '@angular/core';
import { ThemeRegistry, ThemeResolver, ThemeService, provideThemeRuntime, THEME_ARTIFACTS } from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
import { DEFAULT_THEME, FieldProbe, OverrideProbe, MissingInputProbe, NonStandaloneProbe } from '../out-tsc/tests/tests/fixtures/theme-components.js';
const domain = { semantic: 'qa-rating', values: [null, '0', '1', '2', '9223372036854775807.000000001'] };
const controls = [{ id: 'rating', domain, alternatives: ['numeric'] }, { id: 'numeric', domain }];
const renderer = (component = FieldProbe, capability = domain) => ({ component, domain: capability });
const theme = (id, entries) => ({ ...(id === 'default' ? DEFAULT_THEME : { overrides: {} }), id, cssClass: id, controls: entries });

test('optional resolution prefers active alternatives before default requested and preserves base catalogue', () => {
  const injector = Injector.create({ providers: provideThemeRuntime([
    theme('default', { rating: renderer(), numeric: renderer() }), theme('active', { numeric: renderer() }),
    theme('empty', {}),
  ], controls) });
  try {
    const resolver = injector.get(ThemeResolver), service = injector.get(ThemeService);
    assert.equal(THEME_ARTIFACTS.length, 20);
    assert.deepEqual(resolver.resolveControl('rating'), { component: FieldProbe, control: 'rating', theme: 'default' });
    service.activate('active');
    assert.equal(resolver.resolveControl('rating').control, 'numeric');
    assert.equal(resolver.resolveControl('rating').theme, 'active');
    service.activate('empty');
    assert.equal(resolver.resolveControl('rating').theme, 'default');
    service.activate('unknown');
    assert.equal(resolver.resolveControl('rating').control, 'rating');
    assert.throws(() => resolver.resolveControl('unknown'), /Unknown optional/);
  } finally { injector.destroy(); }
});

test('rejects cycles, unknown alternatives, identities and invalid contracts', () => {
  for (const definitions of [
    [controls[0]], [...controls, controls[0]], [{ ...controls[0], id: 'Bad' }],
    [{ ...controls[0], alternatives: ['rating'] }],
    [controls[0], { ...controls[1], alternatives: ['rating'] }],
  ]) assert.throws(() => new ThemeRegistry([DEFAULT_THEME], definitions));
  for (const component of [OverrideProbe, MissingInputProbe, NonStandaloneProbe, null])
    assert.throws(() => new ThemeRegistry([theme('default', { rating: renderer(component) })], controls), /renderer contract/);
  assert.throws(() => new ThemeRegistry([theme('default', { absent: renderer() })], controls), /Unknown optional/);
  for (const values of [[], ['1', '1'], [1], [undefined]])
    assert.throws(() => new ThemeRegistry([DEFAULT_THEME], [{ id: 'rating', domain: { ...domain, values } }]), /domain/);
});

test('compatibility checks semantics, null and every exact domain value without numeric coercion', () => {
  for (const capability of [
    { ...domain, semantic: 'unrelated-string' }, { ...domain, values: domain.values.slice(1) },
    { ...domain, values: [null, '0', '1', '2', '9223372036854775807.000000002'] },
  ]) {
    const injector = Injector.create({ providers: provideThemeRuntime([theme('default', { numeric: renderer(FieldProbe, capability) })], controls) });
    try { assert.throws(() => injector.get(ThemeResolver).resolveControl('rating'), /No compatible/); }
    finally { injector.destroy(); }
  }
});

test('captures immutable domain and alternative snapshots', () => {
  const values = ['0', '1'], alternatives = ['numeric'];
  const registry = new ThemeRegistry([theme('default', { rating: renderer() })], [
    { id: 'rating', domain: { semantic: 'score', values }, alternatives }, controls[1],
  ]);
  values.push('2'); alternatives.length = 0;
  assert.deepEqual(registry.controls[0].domain.values, ['0', '1']);
  assert.deepEqual(registry.controls[0].alternatives, ['numeric']);
  assert(Object.isFrozen(registry.require('default').controls.rating.domain.values));
});

test('ordered depth-first alternatives skip incompatible definitions and retain declared priority', () => {
  const definitions = [
    { id: 'rating', domain, alternatives: ['wrong', 'first', 'last'] },
    { id: 'wrong', domain: { ...domain, semantic: 'other' } },
    { id: 'first', domain, alternatives: ['nested'] }, { id: 'nested', domain }, { id: 'last', domain },
  ];
  const injector = Injector.create({ providers: provideThemeRuntime([
    theme('default', { rating: renderer() }),
    theme('active', { wrong: renderer(), nested: renderer(), last: renderer() }),
  ], definitions) });
  try {
    injector.get(ThemeService).activate('active');
    assert.equal(injector.get(ThemeResolver).resolveControl('rating').control, 'nested');
  } finally { injector.destroy(); }
});

test('optional controls are not required in default and provider compositions remain isolated', () => {
  const first = Injector.create({ providers: provideThemeRuntime([DEFAULT_THEME], [...controls, { id: 'constructor', domain }]) });
  const flag = { semantic: 'qa-flag', values: [true, false, null] };
  const second = Injector.create({ providers: provideThemeRuntime([
    theme('default', { toggle: renderer(FieldProbe, flag) }),
  ], [{ id: 'toggle', domain: flag }]) });
  try {
    assert.throws(() => first.get(ThemeResolver).resolveControl('rating'), /No compatible/);
    assert.throws(() => first.get(ThemeResolver).resolveControl('constructor'), /No compatible/);
    assert.equal(second.get(ThemeResolver).resolveControl('toggle').control, 'toggle');
    assert.throws(() => first.get(ThemeResolver).resolveControl('toggle'), /Unknown optional/);
  } finally { first.destroy(); second.destroy(); }
});
