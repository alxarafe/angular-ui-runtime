import assert from 'node:assert/strict';
import test from 'node:test';
import { ratingRequest } from '../out-tsc/tests/apps/testbed/src/rating-configuration.js';
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
