import { test, expect } from '@playwright/test';

const failures = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  failures.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(request.url()));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
});
test.afterEach(async ({ page }) => { expect(failures.get(page)).toEqual([]); });

for (const stars of [5, 10, 3]) {
  test(`optional rating ${stars} stars preserves domain, state and logical focus`, async ({ page }, testInfo) => {
    await page.goto(`/?scenario=rating&stars=${stars}`);
    const field = page.getByLabel('Rating', { exact: true });
    if (stars === 3) {
      await expect(field).toHaveJSProperty('tagName', 'SELECT');
      await field.selectOption('8');
    } else {
      await field.focus();
      await field.press('ArrowRight');
    }
    await expect(page.getByTestId('rating-value')).toHaveText('8');
    await expect(page.getByTestId('rating-state')).toContainText('Dirty: true');
    await page.getByRole('button', { name: 'Switch with logical focus' }).click();
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('8');
    await expect(field).toHaveJSProperty('tagName', 'SELECT');
    await field.selectOption('9');
    await page.getByRole('button', { name: 'Switch with logical focus' }).click();
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('9');
    await expect(page.getByTestId('rating-state')).toContainText('Synthetic error retained');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/artifacts/testbed/rating/${testInfo.project.name}-${stars}-score.png`, fullPage: true });
    await page.getByRole('button', { name: 'Clear rating' }).click();
    await expect(page.getByTestId('rating-value')).toHaveText('null');
    await page.getByRole('button', { name: 'Numeric fallback' }).click();
    await expect(field).toHaveValue('');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `/artifacts/testbed/rating/${testInfo.project.name}-${stars}.png`, fullPage: true });
  });
}

test('rating exact discrete configuration and noneditable state survive fallback', async ({ page }) => {
  await page.goto('/?scenario=rating&minimum=-2&maximum=18&step=2&stars=5');
  const field = page.getByLabel('Rating', { exact: true });
  await expect(field).toHaveValue('-2');
  await field.focus();
  await field.press('ArrowRight');
  await expect(page.getByTestId('rating-value')).toHaveText('0');
  await page.getByLabel('Disabled', { exact: true }).check();
  await expect(field).toBeDisabled();
  await page.getByRole('button', { name: 'Numeric fallback' }).click();
  await expect(field).toBeDisabled();
  await expect(field).toHaveValue('0');
  await page.getByLabel('Disabled', { exact: true }).uncheck();
  await page.getByLabel('Read only', { exact: true }).check();
  await expect(field).toBeDisabled();
  await page.getByRole('button', { name: 'Stars', exact: true }).click();
  await expect(field).toBeDisabled();
  await expect(page.getByTestId('rating-value')).toHaveText('0');
  await page.goto('/?scenario=rating&minimum=9223372036854775807&maximum=9223372036854775817&step=1');
  await expect(field).toHaveJSProperty('tagName', 'SELECT');
  await field.selectOption('9223372036854775808');
  await expect(page.getByTestId('rating-value')).toHaveText('9223372036854775808');
});
