import assert from 'node:assert/strict';
import test from 'node:test';
import { ratingRequest, matchesNativeRangePositions } from '../out-tsc/tests/apps/testbed/src/rating-configuration.js';
const config = { minimum: '0', maximum: '10', step: '1', stars: 5, nullable: true };

test('QA scales validate exact intervals, steps and presentation before domain construction', () => {
  for (const patch of [
    { minimum: '10', maximum: '0' }, { maximum: '0' }, { step: '0' }, { step: '-1' },
    { step: '3' }, { step: '0.5' }, { maximum: '101' }, { minimum: 'NaN' },
    { minimum: '0'.repeat(129) }, { stars: 0 }, { stars: 11 }, { stars: 2.5 }, { stars: NaN }, { nullable: 'yes' },
  ]) assert.throws(() => ratingRequest({ ...config, ...patch }), /Invalid/);
});

test('QA scale domains distinguish null, zero and exact large scores without shared configuration', () => {
  const quality = ratingRequest({ ...config, maximum: '5' });
  const satisfaction = ratingRequest({ ...config, nullable: false });
  const service = ratingRequest({ ...config, stars: 10 });
  assert.deepEqual(quality.domain.values, [null, '0', '1', '2', '3', '4', '5']);
  assert(!satisfaction.domain.values.includes(null));
  assert.equal(service.presentation.stars, 10);
  assert.equal(satisfaction.presentation.stars, 5);
  const large = ratingRequest({ ...config, minimum: '9223372036854775807', maximum: '9223372036854775809' });
  assert.deepEqual(large.domain.values, [null, '9223372036854775807', '9223372036854775808', '9223372036854775809']);
  assert.deepEqual(ratingRequest({ ...config, minimum: '-2', maximum: '2', step: '2' }).domain.values, [null, '-2', '0', '2']);
});

test('native range requires every selectable position to belong to the exact instance domain', () => {
  const complete = ratingRequest({ ...config, maximum: '4' }).domain.values;
  assert.equal(matchesNativeRangePositions(complete, complete), true);
  // A range at step 1 can also visit 1 and 3, which this field forbids.
  assert.equal(matchesNativeRangePositions([null, '0', '2', '4'], complete), false);
  assert.equal(matchesNativeRangePositions(['0', '2', '4'], complete), false);
  // A correctly configured range at step 2 remains usable, with and without null.
  const stepped = ratingRequest({ ...config, maximum: '4', step: '2' }).domain.values;
  assert.equal(matchesNativeRangePositions([null, '0', '2', '4'], stepped), true);
  // Duplicated points, absent null, and extra unreachable values must not pass.
  assert.equal(matchesNativeRangePositions([null, '0', '2', '2'], stepped), false);
  assert.equal(matchesNativeRangePositions(['0', '2', '4'], stepped), false);
  assert.equal(matchesNativeRangePositions([...stepped, '6'], stepped), false);
  assert.equal(matchesNativeRangePositions(['0', '2'], ['0', '0']), false);
});
