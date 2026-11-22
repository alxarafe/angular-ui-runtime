import { test, expect } from '@playwright/test';
const failures = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = []; failures.set(page, errors);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', event => { if (event.type() === 'error') errors.push(event.text()); });
  page.on('requestfailed', request => errors.push(request.url()));
  page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
  await page.goto('/default-theme/?scenario=form');
});
test.afterEach(async ({ page }) => { expect(failures.get(page)).toEqual([]); });
const form = page => page.getByRole('form', { name: 'Composition example', exact: true });
const ordered = page => page.getByRole('button', { name: 'Use ordered layout', exact: true }).click();
const details = page => page.getByRole('tab', { name: 'Details', exact: true });
const exact = page => page.getByLabel('Exact text', { exact: true });

test('absent layout renders eligible fields and effective actions with exact data and readonly guards', async ({ page }) => {
  const host = form(page);
  await expect(host.getByRole('tab')).toHaveCount(0);
  await expect(host.locator('[data-aur-field]')).toHaveCount(4);
  expect(await host.locator('[data-aur-field]').evaluateAll(nodes => nodes.map(node => node.dataset.aurField))).toEqual(['name', 'exact', 'omitted', 'disabled']);
  await expect(page.getByLabel('Excluded field', { exact: true })).toHaveCount(0);
  await expect(exact(page)).toHaveValue('9223372036854775807.123456789');
  await exact(page).fill('9223372036854775808.000000001');
  await expect(page.getByTestId('form-event')).toContainText('"key":"temporary-a"');
  await expect(page.getByTestId('form-values')).toContainText('9223372036854775808.000000001');
  const previous = await page.getByTestId('form-event').textContent();
  await expect(page.getByLabel('Disabled field', { exact: true })).toBeDisabled();
  await page.getByLabel('Disabled field', { exact: true }).evaluate(node => { node.value = 'invalid edit'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.getByTestId('form-event')).toHaveText(previous);
  await page.getByRole('button', { name: 'Toggle read-only', exact: true }).click();
  await expect(exact(page)).toHaveJSProperty('readOnly', true);
  await exact(page).evaluate(node => { node.value = 'blocked edit'; node.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect(page.getByTestId('form-event')).toHaveText(previous);
  await expect(page.getByTestId('form-values')).toContainText('9223372036854775808.000000001');
});

test('ordered placement diagnoses invalid references and exposes fallback, empty and action-only containers', async ({ page }) => {
  await ordered(page);
  await expect(form(page).getByRole('tab')).toHaveText(['General', 'Details', 'Actions only', 'Empty tab']);
  const codes = await page.evaluate(() => window.__aurFormQa.diagnostics().map(item => item.code));
  expect(codes).toEqual(['unknown-field', 'excluded-field', 'duplicate-field', 'unknown-action']);
  await expect(page.getByRole('status', { name: 'Form layout diagnostics' })).toHaveCount(0);
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(1);
  await expect(exact(page)).toHaveCount(1);
  await expect(exact(page)).toBeHidden();
  await expect(page.getByLabel('Excluded field', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('group', { name: 'Additional fields', exact: true })).toBeVisible();
  await expect(page.getByLabel('Omitted field', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Root action', exact: true }).click();
  await expect(page.getByTestId('form-action')).toHaveText('root-action');
  await page.getByRole('button', { name: 'Tab action', exact: true }).click();
  await expect(page.getByTestId('form-action')).toHaveText('tab-action');
  await details(page).click();
  await expect(page.getByRole('region', { name: 'Action-only section', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Action-only command', exact: true }).click();
  await expect(page.getByTestId('form-action')).toHaveText('only-action');
  const collapse = page.getByRole('button', { name: 'Exact section', exact: true });
  await expect(collapse).toHaveAttribute('aria-expanded', 'false');
  await collapse.click();
  await page.getByRole('button', { name: 'Section action', exact: true }).click();
  await expect(page.getByTestId('form-action')).toHaveText('section-action');
  const disabled = page.getByRole('button', { name: 'Disabled action', exact: true });
  await expect(disabled).toBeDisabled();
  await disabled.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await expect(page.getByTestId('form-action')).toHaveText('section-action');
  await page.getByRole('tab', { name: 'Actions only', exact: true }).click();
  await page.getByRole('button', { name: 'Tab-only command', exact: true }).click();
  await expect(page.getByTestId('form-action')).toHaveText('only-tab-action');
  await page.getByRole('tab', { name: 'Empty tab', exact: true }).click();
  await expect(form(page).getByText('No fields in this tab.', { exact: true })).toBeVisible();
});

test('tabs support roving keyboard focus, wrapping arrows and Home/End without changing field data', async ({ page }) => {
  await ordered(page);
  const general = page.getByRole('tab', { name: 'General', exact: true });
  await general.focus(); await general.press('ArrowRight');
  await expect(details(page)).toBeFocused();
  await expect(details(page)).toHaveAttribute('aria-selected', 'true');
  await details(page).press('End');
  const empty = page.getByRole('tab', { name: 'Empty tab', exact: true });
  await expect(empty).toBeFocused();
  await empty.press('ArrowRight'); await expect(general).toBeFocused();
  await general.press('ArrowLeft'); await expect(empty).toBeFocused();
  await empty.press('Home'); await expect(general).toBeFocused();
  await expect(form(page).locator('[role=tab][tabindex="0"]')).toHaveCount(1);
  await expect(page.getByTestId('form-event')).toHaveText('');
});

test('five themes and frame replacement preserve tab, collapse, consumer values and logical focus', async ({ page }, info) => {
  await ordered(page); await details(page).click();
  const collapse = page.getByRole('button', { name: 'Exact section', exact: true });
  await collapse.click();
  await exact(page).fill('9223372036854775808.123456789');
  await exact(page).evaluate(node => { window.__formOriginal = node; });
  const css = page.getByRole('button', { name: 'css-only', exact: true });
  await css.click(); await expect(css).toBeFocused();
  expect(await exact(page).evaluate(node => window.__formOriginal === node)).toBe(true);
  await exact(page).focus(); await exact(page).press('Alt+t');
  await expect(page.getByTestId('form-theme')).toHaveText('form-frame');
  await expect(exact(page)).toBeFocused();
  await expect(exact(page)).toHaveValue('9223372036854775808.123456789');
  expect(await exact(page).evaluate(node => window.__formOriginal === node)).toBe(false);
  await exact(page).press('Alt+t');
  await expect(exact(page)).toBeFocused();
  await collapse.click();
  for (const id of ['alternative', 'cyberpunk', 'vintage', 'high-contrast', 'default']) {
    const button = page.getByRole('button', { name: id, exact: true });
    await button.click(); await expect(button).toBeFocused();
    await expect(details(page)).toHaveAttribute('aria-selected', 'true');
    await expect(collapse).toHaveAttribute('aria-expanded', 'false');
    await expect(exact(page)).toBeHidden();
    await expect(page.getByTestId('form-values')).toContainText('9223372036854775808.123456789');
  }
  await collapse.click();
  await expect(exact(page)).toHaveValue('9223372036854775808.123456789');
  await expect(exact(page)).toBeVisible();
  const emptyForm = page.getByRole('form', { name: 'Empty form', exact: true });
  await emptyForm.scrollIntoViewIfNeeded();
  await expect(emptyForm).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const defaultCapture = await page.screenshot({ path: `/artifacts/testbed/forms/${info.project.name}-default.png`, fullPage: true });
  expect(defaultCapture.readUInt32BE(20)).toBeGreaterThanOrEqual(await page.evaluate(() => document.documentElement.scrollHeight));
  await exact(page).focus(); await exact(page).press('Alt+t');
  await expect(exact(page)).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await page.locator('[id]').evaluateAll(nodes => new Set(nodes.map(node => node.id)).size === nodes.length)).toBe(true);
  await emptyForm.scrollIntoViewIfNeeded();
  await expect(emptyForm).toBeInViewport();
  const frameCapture = await page.screenshot({ path: `/artifacts/testbed/forms/${info.project.name}-frame.png`, fullPage: true });
  expect(frameCapture.readUInt32BE(20)).toBeGreaterThanOrEqual(await page.evaluate(() => document.documentElement.scrollHeight));
});

test('external reveal opens hidden tab and collapsed section, and empty forms remain named', async ({ page }) => {
  await ordered(page);
  await expect(exact(page)).toBeHidden();
  await page.getByRole('button', { name: 'Reveal exact field', exact: true }).click();
  await expect(page.getByTestId('form-reveal')).toHaveText('true');
  await expect(details(page)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: 'Exact section', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(exact(page)).toBeFocused();
  await expect(page.getByRole('form', { name: 'Empty form', exact: true })).toContainText('No fields in this form.');
  await expect(page.getByTestId('form-event')).toHaveText('');
});


test('controlled visual state and excluded reveal use neutral host boundaries', async ({ page }) => {
  await ordered(page);
  await page.getByRole('button', { name: 'Use external visual state', exact: true }).click();
  await details(page).click();
  const collapse = page.getByRole('button', { name: 'Exact section', exact: true });
  await collapse.click();
  await expect(page.getByTestId('form-state')).toContainText('"selectedTab":"details"');
  await expect(page.getByTestId('form-state')).toContainText('"collapsed":false');
  await exact(page).focus(); await exact(page).press('Alt+t');
  await expect(exact(page)).toBeFocused();
  await expect(details(page)).toHaveAttribute('aria-selected', 'true');
  await expect(collapse).toHaveAttribute('aria-expanded', 'true');
  const excluded = page.getByRole('button', { name: 'Reveal excluded field', exact: true });
  await excluded.click();
  await expect(page.getByTestId('form-reveal')).toHaveText('false');
  await expect(excluded).toBeFocused();
  await expect(page.getByLabel('Excluded field', { exact: true })).toHaveCount(0);
});


test('technical and protected diagnostic metadata remain in memory and out of all DOM surfaces', async ({ page }) => {
  await ordered(page);
  await expect(page.getByRole('tab', { name: 'General', exact: true })).toHaveAttribute('aria-selected', 'true');
  const evidence = await page.evaluate(() => {
    const diagnostics = window.__aurFormQa.diagnostics();
    return { diagnostics, frozen: Object.isFrozen(diagnostics) && diagnostics.every(item =>
      Object.isFrozen(item) && (!item.path || Object.isFrozen(item.path) && item.path.every(Object.isFrozen))) };
  });
  expect(evidence.frozen).toBe(true);
  expect(evidence.diagnostics.find(item => item.code === 'excluded-field').path[0].name).toBe('aur-private-path-token');
  expect(evidence.diagnostics.find(item => item.code === 'unknown-action').id).toBe('aur-private-action-token');
  for (const theme of ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast', 'form-frame']) {
    await page.getByRole('button', { name: theme, exact: true }).click();
    const markup = await page.locator('body').innerHTML();
    for (const secret of ['aur-private-field-token', 'aur-private-path-token', 'aur-private-action-token',
      'unknown-field', 'excluded-field', 'duplicate-field', 'unknown-action']) expect(markup).not.toContain(secret);
  }
  await expect(form(page).locator('xpath=ancestor::*[@data-frame-context][1]')).toHaveAttribute('data-frame-context', JSON.stringify({ id: 'composition-example', label: 'Composition example' }));
  await expect(page.getByLabel('Name', { exact: true })).toHaveCount(1);
  await expect(page.getByLabel('Omitted field', { exact: true })).toBeVisible();
});

test('optional fields resolve independent requests and preserve exact, boolean and null values through active alternatives', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Show optional fields', exact: true }).click();
  const quality = page.getByLabel('Quality score', { exact: true });
  const satisfaction = page.getByLabel('Satisfaction score', { exact: true });
  const service = page.getByLabel('Service score', { exact: true });
  const large = page.getByLabel('Large exact score', { exact: true });
  await expect(quality).toHaveAttribute('max', '5');
  await expect(satisfaction).toHaveAttribute('max', '10');
  await expect(form(page).locator('[data-aur-field=quality] .star')).toHaveCount(5);
  await expect(form(page).locator('[data-aur-field=satisfaction] .star')).toHaveCount(5);
  await expect(form(page).locator('[data-aur-field=service] .star')).toHaveCount(10);
  await expect(large).toHaveJSProperty('tagName', 'SELECT');
  await expect(large.locator('option:checked')).toHaveText('9223372036854775808');
  await quality.focus(); await quality.press('ArrowRight');
  await expect(quality).toHaveValue('4');
  await quality.press('Alt+t');
  await expect(quality).toHaveJSProperty('tagName', 'SELECT');
  await expect(quality).toBeFocused();
  await expect(quality.locator('option:checked')).toHaveText('4');
  await expect(satisfaction.locator('option:checked')).toHaveText('7');
  await expect(service.locator('option:checked')).toHaveText('9');
  await expect(large.locator('option:checked')).toHaveText('9223372036854775808');
  await large.selectOption({ label: '9223372036854775817' });
  await page.getByLabel('Optional flag', { exact: true }).check();
  await expect(page.getByTestId('form-values')).toContainText('"flag":true');
  await quality.selectOption({ label: 'No rating' });
  await expect(page.getByTestId('form-values')).toContainText('"quality":null');
  await quality.selectOption({ label: '0' });
  await expect(page.getByTestId('form-values')).toContainText('"quality":"0"');
  await quality.press('Alt+t');
  await expect(quality).toBeFocused();
  await expect(quality).toHaveValue('0');
  await expect(page.getByTestId('form-values')).toContainText('"large":"9223372036854775817"');
  await expect(page.getByLabel('Optional flag', { exact: true })).toBeChecked();
  for (const id of ['alternative', 'cyberpunk', 'vintage', 'high-contrast']) {
    await page.getByRole('button', { name: id, exact: true }).click();
    await expect(quality).toHaveJSProperty('tagName', 'SELECT');
    await expect(quality.locator('option:checked')).toHaveText('0');
    await expect(large.locator('option:checked')).toHaveText('9223372036854775817');
  }
  await page.getByRole('button', { name: 'default', exact: true }).click();
  const empty = page.getByRole('form', { name: 'Empty form', exact: true });
  await empty.scrollIntoViewIfNeeded(); await expect(empty).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const capture = await page.screenshot({ path: `/artifacts/testbed/forms/${info.project.name}-optional.png`, fullPage: true });
  expect(capture.readUInt32BE(20)).toBeGreaterThanOrEqual(await page.evaluate(() => document.documentElement.scrollHeight));
});

test('reactive optional domains and presentation change the renderer without losing data or logical focus', async ({ page }) => {
  await page.getByRole('button', { name: 'Show optional fields', exact: true }).click();
  const quality = page.getByLabel('Quality score', { exact: true });
  const satisfaction = page.getByLabel('Satisfaction score', { exact: true });
  await satisfaction.evaluate(node => { window.__satisfactionNative = node; });
  await quality.focus(); await quality.press('ArrowRight');
  await expect(page.getByTestId('form-event')).toContainText('"value":"4"');
  const emitted = await page.getByTestId('form-event').textContent();
  await quality.evaluate(node => { window.__qualityNative = node; });
  await quality.press('Alt+d');
  await expect(quality).toHaveAttribute('max', '10');
  await expect(quality).toHaveValue('4');
  await expect(quality).toBeFocused();
  expect(await quality.evaluate(node => node === window.__qualityNative)).toBe(true);
  await quality.press('Alt+d');
  await expect(quality).toHaveAttribute('max', '5');
  await quality.press('Alt+r');
  await expect(quality).toHaveJSProperty('tagName', 'SELECT');
  await expect(quality).toBeFocused();
  await expect(quality.locator('option:checked')).toHaveText('4');
  expect(await satisfaction.evaluate(node => node === window.__satisfactionNative)).toBe(true);
  await expect(satisfaction).toHaveValue('7');
  await expect(page.getByTestId('form-event')).toHaveText(emitted);
  await quality.selectOption({ label: '5' });
  await quality.press('Alt+r');
  await expect(quality).toHaveJSProperty('tagName', 'INPUT');
  await expect(quality).toBeFocused();
  await expect(quality).toHaveValue('5');
  const button = page.getByRole('button', { name: 'Toggle quality presentation', exact: true });
  await button.click(); await expect(button).toBeFocused();
  await expect(quality).toHaveJSProperty('tagName', 'SELECT');
});

test('optional renderers suppress blocked score/clear events in forms after request and theme changes', async ({ page }) => {
  await page.getByRole('button', { name: 'Show optional fields', exact: true }).click();
  const quality = page.getByLabel('Quality score', { exact: true });
  const fieldHost = form(page).locator('[data-aur-field=quality]');
  for (const flag of ['Toggle optional disabled', 'Toggle read-only']) {
    await page.getByRole('button', { name: flag, exact: true }).click();
    await expect(quality).toBeDisabled();
    const clear = fieldHost.getByRole('button', { name: 'No rating', exact: true });
    await expect(clear).toBeDisabled();
    await clear.evaluate(node => node.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await quality.evaluate(node => { node.value = '5'; node.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.getByRole('button', { name: 'Toggle quality presentation', exact: true }).click();
    await expect(quality).toHaveJSProperty('tagName', 'SELECT');
    await expect(quality).toBeDisabled();
    await quality.evaluate(node => { node.value = '0'; node.dispatchEvent(new Event('change', { bubbles: true })); });
    await page.getByRole('button', { name: 'form-frame', exact: true }).click();
    await expect(quality).toBeDisabled();
    await expect(page.getByTestId('form-event')).toHaveText('');
    await expect(page.getByTestId('form-values')).toContainText('"quality":"3"');
    await page.getByRole('button', { name: flag, exact: true }).click();
    await page.getByRole('button', { name: 'default', exact: true }).click();
    await page.getByRole('button', { name: 'Toggle quality presentation', exact: true }).click();
    await expect(quality).toHaveJSProperty('tagName', 'INPUT');
  }
});
