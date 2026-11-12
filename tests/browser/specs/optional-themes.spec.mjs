import { test, expect } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const THEMES = {
  default: { keys: ['shell', 'navigation', 'panel', ...['BOOLEAN', 'STRING', 'TEXT', 'INT8', 'UINT8', 'INT16', 'UINT16', 'INT32', 'UINT32', 'INT64', 'DECIMAL', 'UUID', 'DATE', 'TIME', 'DATETIME', 'ENUM', 'BINARY'].map(type => `field.${type}`)], background: 'rgb(243, 246, 250)' },
  alternative: { keys: ['field.BOOLEAN'], background: 'rgb(242, 247, 242)' },
  cyberpunk: { keys: ['shell', 'panel'], background: 'rgb(21, 20, 43)' },
  vintage: { keys: [], background: 'rgb(244, 236, 216)' },
  'high-contrast': { keys: ['panel'], background: 'rgb(0, 0, 0)' },
};
const REGIONS = ['topbar-start', 'topbar-actions', 'navigation-before', 'navigation-after', 'content-before',
  'contextual-actions', 'content-after', 'floating-actions', 'footer', 'unclaimed'];
const state = async page => JSON.parse(await page.getByTestId('package-resolution').textContent());
const result = (page, id) => page.locator(`[data-field="${id}"] [data-testid="field-result"]`);
async function activate(page, id) {
  await page.locator(`[data-package-theme="${id}"]`).click();
  await expect(page.getByTestId('package-status')).toHaveText(`${id} · 20 artifacts`);
}
async function verifyResolution(page, id) {
  const current = await state(page);
  expect(Object.keys(THEMES).every(theme => current.registered.includes(theme))).toBe(true);
  expect(current.id).toBe(id);
  expect([...current.overrides].sort()).toEqual([...THEMES[id].keys].sort());
  expect(current.artifacts).toHaveLength(20);
  for (const artifact of current.artifacts) {
    expect(artifact.directFallback).toBe(true);
    if (artifact.key.startsWith('field.')) {
      await expect(page.locator(`[data-field="${artifact.key.slice('field.'.length)}"] ${artifact.selector}`)).toHaveCount(1);
    } else await expect(page.locator(artifact.selector)).toHaveCount(1);
  }
  await expect(page.locator('aur-alternative-boolean')).toHaveCount(id === 'alternative' ? 1 : 0);
  await expect(page.locator('aur-cyberpunk-shell')).toHaveCount(id === 'cyberpunk' ? 1 : 0);
  await expect(page.locator('aur-cyberpunk-panel')).toHaveCount(id === 'cyberpunk' ? 1 : 0);
  await expect(page.locator('aur-high-contrast-panel')).toHaveCount(id === 'high-contrast' ? 1 : 0);
  await expect(page.getByRole('navigation', { name: 'Application sections' })).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'Editing fields' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Application action', exact: true })).toHaveCount(1);
  for (const region of REGIONS) {
    const wrapper = page.locator(`[aur-theme-region="${region}"]`);
    await expect(wrapper).toHaveCount(1);
    await wrapper.scrollIntoViewIfNeeded();
    await expect(wrapper).toBeVisible();
  }
  return current;
}

function contrast(foreground, background) {
  const luminance = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

for (const id of Object.keys(THEMES)) test(`${id}: actual optional archives, sparse fallback and safe layout`, async ({ page, browser }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  await page.goto('/default-theme/');
  // Installing/registering optional definitions must not select any of them.
  await expect(page.getByTestId('package-status')).toHaveText('default · 20 artifacts');
  await activate(page, id);
  const resolution = await verifyResolution(page, id);
  await expect(page.locator('aur-theme-shell')).toHaveClass(`theme-${id}`);
  const shell = page.locator(id === 'cyberpunk' ? '.aur-cyberpunk-shell' : '.aur-default-shell');
  const palette = await shell.evaluate(element => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color, font: style.fontFamily, scheme: style.colorScheme };
  });
  expect(palette.background).toBe(THEMES[id].background);
  if (id === 'vintage') expect(palette.font).toContain('Georgia');
  if (id === 'high-contrast') expect(palette.color).toBe('rgb(255, 255, 0)');
  if (id === 'cyberpunk') {
    expect(await page.locator('.aur-cyberpunk-workspace').evaluate(element =>
      !!(element.compareDocumentPosition(document.querySelector('.aur-cyberpunk-tools')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    await page.getByRole('button', { name: 'Account action', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('Application tool', { exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Optional tool', exact: true })).toBeFocused();
  }
  const edits = { STRING: 'Draft retained 😀', TEXT: 'Pending\napplication edit', INT64: '-9223372036854775808',
    DECIMAL: '9007199254740993.123456789', DATE: '2028-02-29', TIME: '23:45:12.123', DATETIME: '2028-02-29T23:45:12.1234567+02:00' };
  for (const [field, value] of Object.entries(edits)) {
    await page.locator(`#${field}`).fill(value);
    await expect(result(page, field)).toHaveText(JSON.stringify(value));
  }
  if (id === 'alternative') {
    for (const [label, value] of [['Yes', true], ['No', false], ['Not set', null], ['Yes', true]]) {
      await page.locator('#BOOLEAN').selectOption({ label });
      await expect(result(page, 'BOOLEAN')).toHaveText(JSON.stringify(value));
    }
  } else await page.locator('#BOOLEAN').check();
  await expect(result(page, 'BOOLEAN')).toHaveText('true');
  const values = await page.getByTestId('package-values').textContent();
  for (const mode of ['Disable fields', 'Read-only fields']) {
    await page.getByRole('button', { name: mode, exact: true }).click();
    await expect(page.locator('#BOOLEAN')).toBeDisabled();
    if (id === 'alternative') {
      await page.locator('#BOOLEAN').evaluate(control => {
        control.value = 'no'; control.dispatchEvent(new Event('change', { bubbles: true })); control.value = 'yes';
      });
      await expect(result(page, 'BOOLEAN')).toHaveText('true');
    }
    await expect(page.getByTestId('package-values')).toHaveText(values);
  }
  await page.getByRole('button', { name: 'Edit fields', exact: true }).click();
  await page.getByRole('button', { name: 'Application action', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('package-intent')).toHaveText('refresh-view');
  await page.getByRole('link', { name: 'Editing fields' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/default-theme\/#STRING$/);
  await page.locator('#STRING').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('#TEXT')).toBeFocused();
  const focus = await page.locator('#TEXT').evaluate(element => ({ visible: element.matches(':focus-visible'),
    outline: getComputedStyle(element).outlineStyle, width: parseFloat(getComputedStyle(element).outlineWidth) }));
  expect(focus.visible).toBe(true); expect(focus.outline).not.toBe('none'); expect(focus.width).toBeGreaterThanOrEqual(3);

  for (const control of await page.locator('aur-theme-shell input, aur-theme-shell textarea, aur-theme-shell select, aur-theme-shell button, aur-theme-shell a').all()) {
    await control.scrollIntoViewIfNeeded();
    await expect(control).toBeInViewport();
    expect(await control.evaluate(element => {
      const box = element.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return box.width > 0 && box.x >= 0 && box.right <= innerWidth && (hit === element || element.contains(hit));
    })).toBe(true);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const directory = `/artifacts/testbed/optional-themes/${info.project.name}/${id}`;
  mkdirSync(directory, { recursive: true });
  const nativeControls = {};
  if (id === 'cyberpunk' || id === 'high-contrast') for (const field of ['DATE', 'TIME']) {
    const control = page.locator(`#${field}`);
    const style = await control.evaluate(element => {
      const style = getComputedStyle(element);
      return { foreground: style.color, background: style.backgroundColor, scheme: style.colorScheme, type: element.type };
    });
    expect(style.scheme).toBe('dark');
    expect(style.type).toBe(field.toLowerCase());
    expect(contrast(style.foreground, style.background)).toBeGreaterThanOrEqual(4.5);
    nativeControls[field] = style;
    await page.locator(`[data-field="${field}"]`).screenshot({ path: `${directory}/${field.toLowerCase()}-control.png`, animations: 'disabled' });
  }
  await page.locator('#TEXT').focus();
  await shell.evaluate(element => element.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `${directory}/viewport.png`, animations: 'disabled' });
  await page.screenshot({ path: `${directory}/full-page.png`, fullPage: true, animations: 'disabled' });

  // A second active default composition must not pick up another theme's palette.
  const outside = await page.evaluate(async () => {
    const host = document.createElement('aur-theme-shell'); host.className = 'theme-default';
    const component = document.createElement('aur-default-shell');
    const root = document.createElement('div'); root.className = 'aur-default-shell';
    const control = document.createElement('button'); control.textContent = 'Unrelated control';
    component.append(root); host.append(component); document.body.append(host, control);
    const background = getComputedStyle(root).backgroundColor;
    const read = () => { const style = getComputedStyle(control); return [style.font, style.color, style.backgroundColor, style.padding]; };
    const styled = read(), sheets = [...document.querySelectorAll('link[rel="stylesheet"]')];
    for (const sheet of sheets) sheet.disabled = true;
    await new Promise(requestAnimationFrame);
    const unstyled = read();
    for (const sheet of sheets) sheet.disabled = false;
    host.remove(); control.remove();
    return { background, untouched: JSON.stringify(styled) === JSON.stringify(unstyled) };
  });
  expect(outside).toEqual({ background: THEMES.default.background, untouched: true });

  await page.locator('#package-application-draft').fill('Unbound application edit');
  await page.locator('#package-tool').fill('Unbound contribution edit');
  await page.evaluate(() => { window.themeDraft = document.getElementById('package-application-draft'); window.themeTool = document.getElementById('package-tool'); window.themeString = document.getElementById('STRING'); });
  const focusTransitions = [];
  for (const next of [...Object.keys(THEMES), 'default', 'high-contrast', 'default']) {
    const previous = await state(page);
    await page.locator('#STRING').focus();
    await page.locator(`[data-package-theme="${next}"]`).evaluate(button => button.click());
    await expect(page.getByTestId('package-status')).toHaveText(`${next} · 20 artifacts`);
    await verifyResolution(page, next);
    await expect(page.getByTestId('package-values')).toHaveText(values);
    const following = await state(page);
    const selector = (snapshot, key) => snapshot.artifacts.find(artifact => artifact.key === key).selector;
    const shellChanged = selector(previous, 'shell') !== selector(following, 'shell');
    const panelChanged = selector(previous, 'panel') !== selector(following, 'panel');
    await expect(page.locator('#STRING')).toBeFocused();
    const retained = await page.locator('#STRING').evaluate(element => document.activeElement === element);
    focusTransitions.push({ from: previous.id, to: next, shellChanged, panelChanged, retained });
    await expect(page.locator('#package-application-draft')).toHaveValue('Unbound application edit');
    await expect(page.locator('#package-tool')).toHaveValue('Unbound contribution edit');
    expect(await page.evaluate(() => window.themeDraft === document.getElementById('package-application-draft') && window.themeTool === document.getElementById('package-tool') && window.themeString === document.getElementById('STRING'))).toBe(true);
  }
  await page.locator('#package-unknown').click();
  await expect(page.getByTestId('package-status')).toHaveText('default · 20 artifacts');
  await expect(page.getByTestId('package-activation')).toHaveText('Activation: false');
  expect(await page.locator('.aur-default-shell').evaluate(element => getComputedStyle(element).backgroundColor)).toBe(THEMES.default.background);
  await expect(page.getByTestId('package-values')).toHaveText(values);
  const builds = JSON.parse(readFileSync('/artifacts/theme-packages-build.json', 'utf8'));
  writeFileSync(`${directory}/evidence.json`, JSON.stringify({ ...builds, theme: id, resolution, palette, nativeControls, focus, outside,
    browser: browser.version(), playwright: '1.58.2', viewport: info.project.use.viewport, errors,
    focusTransitions, panelOnlyFocusPolicy: 'Retained native node focus asserted for every transition; no logical-field mapping',
    results: 'passed all assertions', screenshots: ['viewport.png', 'full-page.png'], visualApproval: 'pending human review' }, null, 2));
  expect(errors).toEqual([]);
});
