/** SPDX-License-Identifier: Apache-2.0
 * Repository-only finite integer scale construction, independent of presentation.
 */
export interface RatingConfiguration {
  readonly minimum: string;
  readonly maximum: string;
  readonly step: string;
  readonly stars: number;
  readonly nullable: boolean;
}
export function ratingRequest(config: RatingConfiguration) {
  if (![config.minimum, config.maximum, config.step].every(value =>
      typeof value === 'string' && value.length <= 128 && /^-?\d+$/.test(value)))
    throw new Error('Invalid exact integer scale');
  if (!Number.isInteger(config.stars) || config.stars < 1 || config.stars > 10 || typeof config.nullable !== 'boolean')
    throw new Error('Invalid rating presentation');
  const min = BigInt(config.minimum), max = BigInt(config.maximum), step = BigInt(config.step);
  if (step <= 0n || max <= min || (max - min) % step || (max - min) / step > 100n)
    throw new Error('Invalid rating interval or step');
  const values: (string | null)[] = config.nullable ? [null] : [];
  for (let value = min; value <= max; value += step) values.push(value.toString());
  return { domain: { semantic: 'qa-discrete-rating', values }, presentation: {
    minimum: config.minimum, maximum: config.maximum, step: config.step, stars: config.stars,
  } };
}

/** Native range inputs can select every min/max/step position. Reject sparse domains. */
export function matchesNativeRangePositions(
  allowed: readonly (string | boolean | null)[],
  selectable: readonly (string | null)[],
): boolean {
  const values = new Set(allowed);
  const positions = new Set(selectable);
  return values.size === allowed.length && positions.size === selectable.length &&
    values.size === positions.size && selectable.every(value => values.has(value));
}
