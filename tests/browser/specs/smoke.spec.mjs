import { test as base, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

// Auto fixture catches bootstrap and interaction failures, even outside assertions.
const test = base.extend({
  browserFailures: [async ({ page }, use, testInfo) => {
    const errors = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('requestfailed', request => errors.push(`requestfailed: ${request.url()} ${request.failure()?.errorText}`));
    page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`); });
    await use();
    await testInfo.attach('browser-errors', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
    expect(errors, 'Browser console, page and request failures').toEqual([]);
  }, { auto: true }],
});
const exact = '9223372036854775807.123456789';
const edited = '12345678901234567890.123456789';

async function capture(page, testInfo, theme) {
  mkdirSync('/artifacts/testbed/screenshots', { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  const name = `${testInfo.project.name}-${theme}`;
  const png = await page.screenshot({ path: `/artifacts/testbed/screenshots/${name}.png`, animations: 'disabled' });
  expect(png.readUInt32BE(16)).toBe(testInfo.project.use.viewport.width);
  expect(png.readUInt32BE(20)).toBe(testInfo.project.use.viewport.height);
  await page.screenshot({ path: `/artifacts/testbed/screenshots/${name}-full.png`, fullPage: true, animations: 'disabled' });
  await testInfo.attach(name, { body: png, contentType: 'image/png' });
}

test('initializes installed package and renders default contracts', async ({ page, browser }, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'UI Runtime browser probes' })).toBeVisible();
  await expect(page.getByText(`Repository-local QA fixture · Package ${JSON.parse(readFileSync('/artifacts/testbed/build-evidence.json', 'utf8')).version}`)).toBeVisible();
  await expect(page.getByTestId('active-theme')).toHaveText('default');
  await expect(page.getByTestId('registered-themes')).toHaveText('default, qa-alternative');
  await expect(page.getByTestId('artifact-count')).toHaveText('20');
  await expect(page.getByTestId('shell-default')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'QA fixture navigation' })).toBeVisible();
  await expect(page.getByTestId('panel-default')).toBeVisible();
  await expect(page.getByLabel('Exact decimal text')).toHaveValue(exact);
  await expect(page.getByLabel('Boolean probe')).toBeChecked();
  await expect(page.getByLabel('Disabled probe')).toBeDisabled();
  await expect(page.getByLabel('Read-only probe')).toHaveAttribute('readonly', '');
  await capture(page, testInfo, 'default');
  writeFileSync(`/artifacts/testbed/browser-${testInfo.project.name}.json`, JSON.stringify({
    browser: browser.version(), viewport: testInfo.project.use.viewport,
    playwright: '1.58.2', themes: ['default', 'qa-alternative'], visualBaselineApproved: false,
  }, null, 2));
});

test('switches synthetic overrides and fallback without losing emitted values', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByLabel('Exact decimal text').fill(edited);
  await expect(page.getByTestId('exact-result')).toHaveText(edited);
  await page.getByLabel('Boolean probe').uncheck();
  await expect(page.getByTestId('boolean-result')).toHaveText('false');
  await page.getByRole('button', { name: 'Alternative QA theme' }).click();
  await expect(page.getByTestId('active-theme')).toHaveText('qa-alternative');
  await expect(page.getByTestId('panel-alternative')).toBeVisible();
  await expect(page.locator('[data-renderer=alternative] input')).toHaveValue(edited);
  await expect(page.getByLabel('Boolean probe')).not.toBeChecked();
  await expect(page.getByTestId('shell-default')).toBeVisible();
  await expect(page.getByRole('navigation')).toBeVisible();
  await capture(page, testInfo, 'alternative');
  await page.getByRole('button', { name: 'Unknown theme fallback' }).click();
  await expect(page.getByTestId('active-theme')).toHaveText('default');
  await expect(page.getByTestId('theme-status')).toContainText('Activation: false');
  await expect(page.getByTestId('panel-default')).toBeVisible();
  await expect(page.getByLabel('Exact decimal text')).toHaveValue(edited);
});

test('supports keyboard controls and viewport layout in both synthetic themes', async ({ page }) => {
  await page.goto('/');
  for (const label of ['Default QA theme', 'Alternative QA theme']) {
    const button = page.getByRole('button', { name: label });
    await button.focus();
    await expect(button).toBeFocused();
    expect(await button.evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('link', { name: 'Field probes' }).click();
    const field = page.getByLabel('Exact decimal text');
    await field.focus();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type(exact);
    await expect(page.getByTestId('exact-result')).toHaveText(exact);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const element of [page.getByRole('navigation'), field, page.getByLabel('Read-only probe')]) {
      await element.scrollIntoViewIfNeeded();
      await expect(element).toBeInViewport();
      const box = await element.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
    }
  }
});
