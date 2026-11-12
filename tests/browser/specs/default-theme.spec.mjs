import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const edits = {
  STRING: 'Preserved draft 😀', TEXT: 'Multiple lines\nwith exact text',
  INT8: '-127', UINT8: '254', INT16: '-32767', UINT16: '65534',
  INT32: '-2147483647', UINT32: '4294967294', INT64: '-9223372036854775808',
  DECIMAL: '9007199254740993.1234567890123456789', UUID: '123e4567-e89b-42d3-a456-426614174000',
  DATE: '2028-02-29', TIME: '23:45:12.123', DATETIME: '2028-02-29T23:45:12.1234567+02:00',
};
const result = (page, id) => page.locator(`[data-field="${id}"] [data-testid="field-result"]`);

test('installed default package covers every mapping, projection, state and accessible controls', async ({ page, browser }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto('/default-theme/');
  // Package CSS must not restyle ordinary controls outside its own components.
  expect(await page.evaluate(async () => {
    const probe = document.createElement('div');
    const button = document.createElement('button'); button.textContent = 'Unrelated control';
    const input = document.createElement('input');
    probe.append(button, input); document.body.append(probe);
    const read = () => [button, input].map(element => {
      const style = getComputedStyle(element);
      return [style.font, style.color, style.backgroundColor, style.border, style.padding, style.boxSizing];
    });
    const styled = read();
    const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')];
    for (const sheet of sheets) sheet.disabled = true;
    await new Promise(requestAnimationFrame);
    const unstyled = read();
    for (const sheet of sheets) sheet.disabled = false;
    probe.remove();
    return JSON.stringify(styled) === JSON.stringify(unstyled);
  })).toBe(true);
  await expect(page.getByTestId('package-status')).toHaveText('default · 20 artifacts');
  await expect(page.locator('[data-field]')).toHaveCount(17);
  await expect(page.locator('aur-default-shell')).toHaveCount(1);
  await expect(page.locator('aur-default-panel')).toHaveCount(1);
  await expect(page.getByRole('navigation', { name: 'Application sections' })).toHaveCount(1);
  await expect(page.locator('#BOOLEAN')).toHaveJSProperty('indeterminate', true);
  await expect(page.locator('#STRING')).toHaveValue('');
  await expect(result(page, 'STRING')).toHaveText('null');
  await expect(result(page, 'ENUM')).toHaveText('null');
  await expect(page.locator('#precise-time')).toHaveAttribute('type', 'text');
  await expect(page.locator('#precise-time')).toHaveValue('12:34:56.1234567');
  await page.locator('#precise-time').fill('23:45:12.7654321');
  await expect(page.getByTestId('precise-time-result')).toHaveText('23:45:12.7654321');
  await page.locator('#BOOLEAN').check();
  await expect(result(page, 'BOOLEAN')).toHaveText('true');
  for (const [id, value] of Object.entries(edits)) {
    await page.locator(`#${id}`).fill(value);
    await expect(page.locator(`#${id}`)).toHaveValue(value);
    await expect(result(page, id)).toHaveText(JSON.stringify(value));
  }
  await page.locator('#ENUM').selectOption({ index: 1 });
  await expect(result(page, 'ENUM')).toHaveText('""');
  await page.locator('#ENUM').selectOption({ index: 0 });
  await expect(result(page, 'ENUM')).toHaveText('null');
  await page.locator('#ENUM').selectOption({ index: 3 });
  await expect(result(page, 'ENUM')).toHaveText('"Not set"');
  await page.locator('#ENUM').selectOption({ index: 2 });
  await expect(result(page, 'ENUM')).toHaveText('"ready"');
  await expect(page.locator('#BINARY')).toHaveText('');
  await page.getByRole('button', { name: 'Supply binary output' }).click();
  await expect(page.locator('#BINARY')).toHaveText('Zm9v');
  await expect(result(page, 'BINARY')).toHaveText('"Zm9v"');

  const values = await page.getByTestId('package-values').textContent();
  for (const mode of ['Disable fields', 'Read-only fields']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    for (const id of ['BOOLEAN', ...Object.keys(edits), 'ENUM']) {
      const control = page.locator(`#${id}`);
      if (mode === 'Disable fields' || ['BOOLEAN', 'ENUM'].includes(id)) await expect(control).toBeDisabled();
      else await expect(control).toHaveJSProperty('readOnly', true);
    }
    // Synthetic events exercise mutation guards in addition to native browser blocking.
    await page.locator('[data-field] input, [data-field] textarea, [data-field] select').evaluateAll(controls => {
      for (const control of controls) {
        const value = control.value, checked = control.checked, index = control.selectedIndex;
        if (control.type === 'checkbox') control.checked = !control.checked;
        else if (control instanceof HTMLSelectElement) control.selectedIndex = 1;
        else control.value = 'Blocked edit';
        control.dispatchEvent(new Event(control.type === 'checkbox' || control instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
        control.value = value;
        if (control.type === 'checkbox') control.checked = checked;
        if (control instanceof HTMLSelectElement) control.selectedIndex = index;
      }
    });
    await expect(page.getByTestId('package-values')).toHaveText(values);
  }
  await page.getByRole('button', { name: 'Edit fields', exact: true }).click();
  for (const id of ['BOOLEAN', ...Object.keys(edits), 'ENUM', 'BINARY']) {
    expect(await page.locator(`#${id}`).evaluate(control => control.labels?.length)).toBe(1);
  }
  await page.getByRole('button', { name: 'Application action', exact: true }).click();
  await expect(page.getByTestId('package-intent')).toHaveText('refresh-view');
  await expect(page.getByText('Unavailable action', { exact: true })).toHaveAttribute('aria-disabled', 'true');
  await page.locator('#package-application-draft').fill('Unbound projected edit');
  await page.locator('#package-tool').fill('Unbound tool edit');
  await page.evaluate(() => {
    window.defaultDraft = document.getElementById('package-application-draft');
    window.defaultTool = document.getElementById('package-tool');
    window.defaultString = document.getElementById('STRING');
    window.defaultShell = document.querySelector('aur-default-shell');
  });
  await page.locator('#package-css').click();
  expect(await page.evaluate(() => window.defaultShell === document.querySelector('aur-default-shell'))).toBe(true);
  for (const id of ['package-structural', 'package-default', 'package-unknown']) {
    await page.locator('#STRING').focus();
    await page.locator(`#${id}`).evaluate(button => button.click());
    await expect(page.getByTestId('package-status')).toHaveText(`${id === 'package-structural' ? 'independent-structure' : 'default'} · 20 artifacts`);
    await expect(page.getByTestId('package-values')).toHaveText(values);
    await expect(page.locator('#STRING')).toBeFocused();
    expect(await page.evaluate(() => window.defaultDraft === document.getElementById('package-application-draft') && window.defaultTool === document.getElementById('package-tool') && window.defaultString === document.getElementById('STRING'))).toBe(true);
    await expect(page.locator('#package-application-draft')).toHaveValue('Unbound projected edit');
    await expect(page.locator('#package-tool')).toHaveValue('Unbound tool edit');
  }
  await expect(page.locator('aur-default-shell')).toHaveCount(1);
  await expect(page.locator('aur-default-panel')).toHaveCount(1);
  await expect(page.getByRole('navigation')).toHaveCount(1);
  for (const id of ['topbar-start', 'topbar-actions', 'navigation-before', 'navigation-after', 'content-before',
    'contextual-actions', 'content-after', 'floating-actions', 'footer', 'unclaimed'])
    await expect(page.locator(`[aur-theme-region="${id}"]`)).toHaveCount(1);
  await page.getByRole('link', { name: 'Editing fields' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/default-theme\/#STRING$/);
  await page.locator('#STRING').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#TEXT')).toBeFocused();
  const focus = await page.locator('#TEXT').evaluate(element => ({ visible: element.matches(':focus-visible'), outline: getComputedStyle(element).outlineStyle }));
  expect(focus.visible).toBe(true);
  expect(focus.outline).not.toBe('none');

  // Each essential interactive control must be horizontally reachable and not covered.
  for (const control of await page.locator('aur-default-shell input, aur-default-shell textarea, aur-default-shell select, aur-default-shell button, aur-default-shell a').all()) {
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport();
    expect(await control.evaluate(element => {
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return box.width > 0 && box.x >= 0 && box.right <= innerWidth && (hit === element || element.contains(hit));
    })).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const directory = `/artifacts/testbed/default-theme/${info.project.name}`;
  mkdirSync(directory, { recursive: true });
  await page.locator('#TEXT').focus();
  await page.locator('aur-default-shell').evaluate(element => element.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `${directory}/viewport.png`, animations: 'disabled' });
  await page.screenshot({ path: `${directory}/full-page.png`, fullPage: true, animations: 'disabled' });
  const build = JSON.parse(readFileSync('/artifacts/theme-default-build.json'));
  writeFileSync(`${directory}/evidence.json`, JSON.stringify({ ...build, chromium: browser.version(), playwright: '1.58.2',
    viewport: info.project.use.viewport, results: 'all 17 mappings; representative edits; BINARY application-supplied output only',
    focus, errors, screenshots: ['viewport.png', 'full-page.png'], visualApproval: 'pending human review' }, null, 2));
  expect(errors).toEqual([]);
});
