import assert from 'node:assert/strict';
import test from 'node:test';
import { Injector, runInInjectionContext } from '@angular/core';
import { AlternativeBooleanRenderer, BOOLEAN_CHOICES } from '../out-tests/src/public-api.js';

test('independent BOOLEAN preserves true, false and null and ignores unknown tokens', () => {
  const injector = Injector.create({ providers: [] });
  try {
    const renderer = runInInjectionContext(injector, () => new AlternativeBooleanRenderer());
    const context = { id: 'boolean', label: 'Boolean', value: null };
    Object.defineProperty(renderer, 'context', { value: () => context });
    const values = [];
    renderer.valueChange.subscribe(value => values.push(value));
    for (const choice of [BOOLEAN_CHOICES.yes, BOOLEAN_CHOICES.no, BOOLEAN_CHOICES.unset, 'unknown']) renderer.select(choice);
    assert.deepEqual(values, [true, false, null]);
    context.disabled = true;
    renderer.select(BOOLEAN_CHOICES.yes);
    context.disabled = false;
    context.readOnly = true;
    renderer.select(BOOLEAN_CHOICES.no);
    assert.deepEqual(values, [true, false, null]);
  } finally { injector.destroy(); }
});
