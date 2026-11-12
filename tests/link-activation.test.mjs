import assert from 'node:assert/strict';
import test from 'node:test';
import { activateThemeLink } from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
const item = { id: 'draft', label: 'Draft', href: '/draft?q=exact#section' };
const click = (properties = {}) => Object.defineProperties(new Event('click', { cancelable: true }),
  Object.fromEntries(Object.entries({ button: 0, ...properties }).map(([key, value]) => [key, { value }])));

test('link activation cancels the original event synchronously and preserves exact identity/href', () => {
  const event = click();
  let count = 0;
  activateThemeLink(item, event, activation => {
    count++;
    assert.equal(activation.itemId, item.id); assert.equal(activation.href, item.href);
    assert.equal(activation.defaultPrevented, false);
    activation.preventDefault(); activation.preventDefault();
    assert.equal(activation.defaultPrevented, true);
    assert(Object.isFrozen(activation));
  });
  assert.equal(count, 1); assert.equal(event.defaultPrevented, true);
});
test('no callback, passive callback, modifiers, nonprimary and disabled entries retain native dispatch', () => {
  const native = click(); activateThemeLink(item, native); assert.equal(native.defaultPrevented, false);
  activateThemeLink(item, native, () => {}); assert.equal(native.defaultPrevented, false);
  for (const properties of [{ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {altKey: true}, {button: 1}, {button: 2}])
    activateThemeLink(item, click(properties), () => assert.fail('Native gesture must not dispatch interception'));
  for (const invalid of [{ ...item, disabled: true }, { id: 'action', label: 'Action' }])
    activateThemeLink(invalid, click(), () => assert.fail('Not an enabled link'));
  native.preventDefault(); activateThemeLink(item, native, () => assert.fail('Already cancelled'));
});
test('cancellation after callback return or await is deliberately ineffective', async () => {
  const event = click(); let saved;
  activateThemeLink(item, event, activation => { saved = activation; });
  await Promise.resolve(); saved.preventDefault(); assert.equal(event.defaultPrevented, false);
  let afterThrow;
  assert.throws(() => activateThemeLink(item, event, activation => { afterThrow = activation; throw new Error('consumer'); }), /consumer/);
  afterThrow.preventDefault(); assert.equal(event.defaultPrevented, false);
});
