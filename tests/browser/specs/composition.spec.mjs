import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

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
  await page.locator('#port-panel-only').click();
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
