import { test as base, expect } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const test = base.extend({
  errors: [async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await use(errors);
    expect(errors).toEqual([]);
  }, { auto: true }],
});
const start = async (page, mode) => {
  await page.goto(`/default-theme/?scenario=navigation&mode=${mode}`);
  await expect(page.getByRole('heading', { name: 'Neutral link activation QA' })).toBeVisible();
  await page.evaluate(() => { window.navigationDocument = document; window.navigationNode = document.getElementById('navigation-draft'); });
};
const count = (page, value) => expect(page.getByTestId('navigation-count')).toHaveText(String(value));

test('native, observing and late callbacks retain ordinary href behavior', async ({ page }) => {
  for (const mode of ['native', 'observe', 'late']) {
    await start(page, mode);
    await page.getByLabel('Navigation draft').fill('Exact unsaved state');
    await page.getByRole('link', { name: 'Fragment link', exact: true }).click();
    await expect(page).toHaveURL(/#native-fragment$/);
    await count(page, mode === 'native' ? 0 : 1);
    await expect(page.getByTestId('link-cancelled')).toHaveText('false');
    await expect(page.getByTestId('action-count')).toHaveText('0');
    expect(await page.evaluate(() => window.navigationDocument === document)).toBe(true);
    // A query link is a real document navigation when not cancelled, with no library reload.
    const response = page.waitForNavigation();
    await page.getByRole('link', { name: 'Internal query link' }).click();
    await response;
    await expect(page).toHaveURL(/destination=first#native-fragment$/);
    expect(await page.evaluate(() => window.navigationDocument === undefined)).toBe(true);
  }
});

test('consumer SPA policy owns history, Enter, cancellation and unsaved state', async ({ page }) => {
  await start(page, 'spa');
  const initial = page.url();
  await page.getByLabel('Navigation draft').fill('9223372036854775807 unsaved');
  const link = page.getByRole('link', { name: 'Internal query link' });
  await link.click(); await count(page, 1);
  await expect(page.getByTestId('link-cancelled')).toHaveText('true');
  await expect(page).toHaveURL(/destination=first#native-fragment$/);
  expect(await page.evaluate(() => window.navigationDocument === document && window.navigationNode === document.getElementById('navigation-draft'))).toBe(true);
  await page.goBack(); await expect(page).toHaveURL(initial);
  await expect(page.getByTestId('navigation-route')).toHaveText(initial);
  await page.goForward(); await expect(page).toHaveURL(/destination=first#native-fragment$/);
  await expect(page.getByTestId('navigation-route')).toHaveText(page.url());
  await link.focus(); await page.keyboard.press('Enter'); await count(page, 2);
  await expect(page.getByTestId('action-count')).toHaveText('0');
  await expect(page.getByLabel('Navigation draft')).toHaveValue('9223372036854775807 unsaved');
  await start(page, 'reject');
  const rejected = page.url();
  await page.getByRole('link', { name: 'Internal query link' }).click();
  await count(page, 1); await expect(page).toHaveURL(rejected);
  await expect(page.getByTestId('link-cancelled')).toHaveText('true');
  expect(await page.evaluate(() => window.navigationDocument === document)).toBe(true);
});

test('modified clicks, auxiliary/context gestures, target and download remain native', async ({ page, context }, info) => {
  await start(page, 'spa');
  const gestures = [];
  // Observe DOM cancellation after the component handler, without changing browser defaults.
  const link = page.getByRole('link', { name: 'Fragment link', exact: true });
  await link.evaluate(anchor => {
    window.nativeGestures = [];
    for (const type of ['click', 'auxclick', 'contextmenu']) anchor.addEventListener(type, event => {
      window.nativeGestures.push({ type, button: event.button, prevented: event.defaultPrevented });
    });
  });
  for (const modifier of ['Control', 'Meta', 'Shift', 'Alt']) {
    await link.click({ modifiers: [modifier] });
    await count(page, 0);
    gestures.push({ modifier, url: page.url() });
    for (const popup of context.pages().filter(candidate => candidate !== page)) await popup.close();
  }
  await link.click({ button: 'middle' });
  await link.click({ button: 'right' });
  await page.keyboard.press('Escape');
  await count(page, 0);
  const events = await page.evaluate(() => window.nativeGestures);
  expect(events.some(event => event.type === 'auxclick' && event.button === 1)).toBe(true);
  expect(events.some(event => event.type === 'contextmenu')).toBe(true);
  expect(events.every(event => !event.prevented)).toBe(true);
  for (const popup of context.pages().filter(candidate => candidate !== page)) await popup.close();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('link', { name: 'New tab link' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState();
  expect(popup.url()).toContain('mode=native'); await popup.close();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download file' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('navigation.txt');
  await count(page, 0); await expect(page.getByTestId('action-count')).toHaveText('0');
  const directory = `/artifacts/testbed/navigation/${info.project.name}`;
  mkdirSync(directory, { recursive: true });
  writeFileSync(`${directory}/native-gestures.json`, JSON.stringify({ gestures, events, platform: 'Linux Chromium; Meta modifier exercised, not physical macOS' }, null, 2));
});

test('ordered hierarchy, current/disabled entries, actions and keyboard semantics stay distinct', async ({ page }) => {
  await start(page, 'spa');
  const nav = page.getByRole('navigation', { name: 'Application sections' });
  await expect(nav).toHaveCount(1);
  await expect(nav.getByRole('link')).toHaveText(['Current page', 'Internal query link', 'Fragment link', 'External link', 'New tab link', 'Download file']);
  const current = nav.getByRole('link', { name: 'Current page' });
  await expect(current).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByText('Navigation group', { exact: true })).not.toHaveAttribute('href');
  const disabled = nav.getByText('Disabled link', { exact: true });
  await expect(disabled).toHaveAttribute('aria-disabled', 'true');
  const initial = page.url(); await disabled.click(); await expect(page).toHaveURL(initial);
  await current.focus(); await page.keyboard.press('Tab');
  await expect(nav.getByRole('link', { name: 'Internal query link' })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(current).toBeFocused();
  await nav.getByRole('button', { name: 'Consumer action' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('action-count')).toHaveText('1'); await count(page, 0);
});

test('all five packaged themes forward one link request without losing owned state or focus', async ({ page }, info) => {
  await start(page, 'spa');
  const draft = page.getByLabel('Navigation draft');
  await draft.fill('Application-owned exact edit');
  let expected = 0;
  for (const theme of ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast', 'default', 'cyberpunk', 'high-contrast', 'default']) {
    await draft.focus();
    await page.locator(`[data-navigation-theme="${theme}"]`).evaluate(button => button.click());
    await expect(page.getByTestId('navigation-theme')).toHaveText(theme);
    await expect(draft).toBeFocused();
    await expect(draft).toHaveValue('Application-owned exact edit');
    await expect(page.getByTestId('navigation-draft-state')).toHaveText('Application-owned exact edit');
    await expect(page.getByRole('navigation')).toHaveCount(1);
    await page.getByRole('link', { name: 'Internal query link' }).click();
    await count(page, ++expected); await expect(page.getByTestId('action-count')).toHaveText('0');
    expect(await page.evaluate(() => window.navigationDocument === document && window.navigationNode === document.getElementById('navigation-draft'))).toBe(true);
  }
  const directory = `/artifacts/testbed/navigation/${info.project.name}`;
  mkdirSync(directory, { recursive: true });
  await page.screenshot({ path: `${directory}/consumer.png`, fullPage: true });
});

test('external links are native unless explicitly cancelled by the consumer', async ({ page }) => {
  await start(page, 'reject');
  const initial = page.url();
  await page.getByRole('link', { name: 'External link' }).click();
  await count(page, 1); await expect(page).toHaveURL(initial);
  await expect(page.getByTestId('link-last')).toHaveText(JSON.stringify({ itemId: 'external', href: 'https://external.example/landing?query=exact#end' }));
  await start(page, 'observe');
  // A deterministic HTTP destination; the runtime/navigation engine is not mocked.
  await page.route('https://external.example/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>External destination</h1>' }));
  await page.getByRole('link', { name: 'External link' }).click();
  await expect(page).toHaveURL('https://external.example/landing?query=exact#end');
  await expect(page.getByRole('heading', { name: 'External destination' })).toBeVisible();
});
