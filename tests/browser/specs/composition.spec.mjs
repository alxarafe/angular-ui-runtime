import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// Let zoneless change detection and its after-render work finish before counting focus calls.
async function rendered(page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test('independent ports retain owned views, navigation intent and named regions', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto('/?scenario=composition');
  const draft = page.getByLabel('Application draft', { exact: true });
  const tool = page.getByLabel('Application tool draft');
  await draft.fill('9223372036854775807.123456789 pending');
  await tool.fill('Unbound DOM edit');
  await page.getByRole('button', { name: 'Application counter 0' }).click();
  await expect(page.getByRole('navigation', { name: 'Composition navigation' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Go to draft' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('button', { name: 'Unavailable action' })).toBeDisabled();
  await page.getByRole('button', { name: 'Application action', exact: true }).click();
  await expect(page.getByTestId('navigation-intent')).toHaveText('application-action');
  await page.getByRole('button', { name: 'Update navigation' }).click();
  await expect(page.getByRole('button', { name: 'Later action' })).toHaveCount(1);
  await page.evaluate(() => {
    window.ownedDraft = document.getElementById('port-draft');
    window.ownedTool = document.getElementById('port-tool');
    window.originalShell = document.querySelector('qa-port-shell');
  });
  // CSS-only identity changes preserve the structural instance.
  await page.locator('#port-css').click();
  expect(await page.evaluate(() => window.originalShell === document.querySelector('qa-port-shell'))).toBe(true);
  await draft.focus();
  await page.locator('#port-panel-only').evaluate(button => button.click());
  await expect(draft).toBeFocused();
  await expect(page.getByTestId('alternate-port-panel')).toBeVisible();
  expect(await page.evaluate(() => window.originalShell === document.querySelector('qa-port-shell') && window.ownedDraft === document.getElementById('port-draft'))).toBe(true);
  for (const button of ['port-alternate', 'port-default', 'port-alternate', 'port-unknown']) {
    await draft.focus();
    // Native programmatic click avoids moving focus away before the structural switch.
    await page.locator(`#${button}`).evaluate(element => element.click());
    await expect(page.getByTestId('port-effective')).toHaveText(button === 'port-alternate' ? 'qa-structural' : 'default');
    await expect(draft).toHaveValue('9223372036854775807.123456789 pending');
    await expect(draft).toBeFocused();
    await expect(tool).toHaveValue('Unbound DOM edit');
    expect(await page.evaluate(() => window.ownedDraft === document.getElementById('port-draft') && window.ownedTool === document.getElementById('port-tool'))).toBe(true);
    await expect(page.getByRole('button', { name: 'Application counter 1' })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Tool counter 1' })).toHaveCount(1);
    await expect(page.getByRole('navigation')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Later action' })).toHaveCount(1);
    await expect(page.getByTestId('unclaimed-regions').getByRole('button', { name: 'Unplaced application action' })).toHaveCount(1);
    const region = button === 'port-alternate' ? 'header' : 'aside[aria-label="Named tools"]';
    await expect(page.locator(`${region} #port-tool`)).toHaveCount(1);
    await page.getByRole('button', { name: 'Application action', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Later action' })).toBeFocused();
    expect(await page.getByRole('button', { name: 'Later action' }).evaluate(element => getComputedStyle(element).outlineStyle)).not.toBe('none');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  // Replacing one supplied template intentionally destroys only that view.
  await page.locator('#port-content-toggle').click();
  await expect(page.getByText('Replacement content', { exact: true })).toBeVisible();
  await rendered(page);
  await expect(tool).toHaveValue('Unbound DOM edit');
  await page.locator('#port-content-toggle').click();
  await expect(draft).toHaveValue('9223372036854775807.123456789 pending');
  for (const button of ['port-default', 'port-alternate']) {
    await page.locator(`#${button}`).click();
    await expect(page.getByTestId(button === 'port-default' ? 'port-panel' : 'alternate-port-panel')).toBeVisible();
    await page.getByRole('link', { name: 'Go to draft' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\?scenario=composition#port-draft$/);
    const directory = `/artifacts/testbed/composition/${info.project.name}`;
    mkdirSync(directory, { recursive: true });
    await page.screenshot({ path: `${directory}/${button}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('panel focus follows only surviving owned nodes without stealing or duplicate restoration', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto('/?scenario=composition');
  const draft = page.getByLabel('Application draft', { exact: true });
  await draft.fill('Application-owned unsaved edit');
  await page.getByRole('button', { name: 'Application counter 0' }).click();
  await page.evaluate(() => {
    window.focusNode = document.getElementById('port-draft');
    const focus = window.focusNode.focus.bind(window.focusNode);
    window.focusCalls = 0;
    window.focusNode.focus = options => { window.focusCalls++; focus(options); };
  });
  let previous = 'port-default';
  for (const id of ['port-panel-only', 'port-default', 'port-panel-only', 'port-unknown',
    'port-css', 'port-default', 'port-alternate', 'port-default']) {
    await draft.focus();
    await page.evaluate(() => { window.focusCalls = 0; });
    await page.locator(`#${id}`).evaluate(button => button.click());
    const effective = id === 'port-panel-only' ? 'qa-panel-only' : id === 'port-alternate' ? 'qa-structural' : id === 'port-css' ? 'qa-css-only' : 'default';
    await expect(page.getByTestId('port-effective')).toHaveText(effective);
    await rendered(page);
    await expect(draft).toBeFocused();
    expect(await page.evaluate(() => window.focusNode === document.getElementById('port-draft'))).toBe(true);
    await expect(draft).toHaveValue('Application-owned unsaved edit');
    await expect(page.getByTestId('port-draft-result')).toHaveText('Application-owned unsaved edit');
    await expect(page.getByRole('button', { name: 'Application counter 1' })).toHaveCount(1);
    const calls = await page.evaluate(() => window.focusCalls);
    expect(calls).toBeLessThanOrEqual(1);
    if (id === 'port-css' || (previous === 'port-css' && id === 'port-default')) expect(calls).toBe(0);
    previous = id;
  }
  // Another application control wins focus during panel mounting, before restoration.
  await draft.focus();
  await page.evaluate(() => {
    window.focusCalls = 0;
    document.getElementById('port-css').setAttribute('data-qa-focus-on-panel-mount', '');
  });
  await page.locator('#port-panel-only').evaluate(button => button.click());
  await expect(page.getByTestId('alternate-port-panel')).toBeVisible();
  await expect(page.locator('#port-css')).toBeFocused();
  expect(await page.evaluate(() => window.focusCalls)).toBe(0);
  await page.locator('#port-css').evaluate(button => button.removeAttribute('data-qa-focus-on-panel-mount'));
  // A real user click selects the outside trigger; the retained input must not reclaim focus.
  await draft.focus();
  await page.locator('#port-default').click();
  await expect(page.locator('#port-default')).toBeFocused();
  await rendered(page);
  // Destroying the supplied view never maps focus to a newly created control with the same ID.
  await draft.focus();
  await page.evaluate(() => { window.focusCalls = 0; });
  await page.locator('#port-content-toggle').evaluate(button => button.click());
  await expect(page.getByText('Replacement content', { exact: true })).toBeVisible();
  await rendered(page);
  expect(await page.evaluate(() => window.focusNode.isConnected)).toBe(false);
  await page.locator('#port-content-toggle').evaluate(button => button.click());
  await expect(draft).toBeVisible();
  await rendered(page);
  await expect(draft).not.toBeFocused();
  await expect(draft).toHaveValue('Application-owned unsaved edit');
  expect(await page.evaluate(() => window.focusNode === document.getElementById('port-draft'))).toBe(false);
  expect(await page.evaluate(() => window.focusCalls)).toBe(0);
  expect(errors).toEqual([]);
});
