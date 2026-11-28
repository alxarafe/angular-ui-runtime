import { test, expect } from '@playwright/test';
const runtimeErrors = new WeakMap();
test.beforeEach(async ({ page }) => {
    const errors = [];
    runtimeErrors.set(page, errors);
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error' && message.text().startsWith('ERROR'))
            errors.push(message.text());
    });
});
test.afterEach(async ({ page }) => {
    expect(runtimeErrors.get(page)).toEqual([]);
});
const themes = ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast'];
const values = [
    null,
    '',
    false,
    true,
    'false',
    '01',
    ' spaced ',
    'e\u0301',
    'é',
    '9223372036854775807.000000001',
];
const snapshot = async (page) =>
    JSON.parse(await page.getByTestId('optional-snapshot').textContent());
const events = async (page) => JSON.parse(await page.getByTestId('optional-events').textContent());
const mainInput = async (page) => (await snapshot(page)).current.properties.main.input;
const rowInput = async (page, key = 'a') =>
    (await snapshot(page)).current.properties.rows.rows.find((row) => row.key === key).value
        .properties.choice.input;
const header = (page) => page.locator('aur-form-field[data-aur-field="main"]');
const rowField = (page) =>
    page
        .locator('aur-form-field')
        .filter({ has: page.getByLabel('Row optional — Row a draft', { exact: true }) });
async function open(page) {
    await page.goto('/default-theme/?scenario=optional-editor');
    await expect(
        header(page).getByLabel('Optional value optional selection', { exact: true }),
    ).toHaveValue('5');
    expect(await events(page)).toEqual({ fields: 0, cells: 0, legacy: 0, last: null });
}
async function unchanged(page, button) {
    const state = await snapshot(page),
        counts = await events(page);
    await page.getByRole('button', { name: button, exact: true }).evaluate((el) => el.click());
    await expect.poll(() => snapshot(page)).toEqual(state);
    expect(await events(page)).toEqual(counts);
}

test('lossless optional controls preserve exact primitives and raw/unknown/absent states without default choices', async ({
    page,
}) => {
    await open(page);
    const scope = header(page),
        scalar = scope.getByLabel('Optional value optional selection', { exact: true });
    const draft = scope.getByLabel('Optional value draft', { exact: true });
    const fallback = scope.getByLabel('Optional value exact value', { exact: true });
    for (const [index, value] of values.entries()) {
        const before = await events(page);
        await scalar.selectOption(String(index));
        await expect.poll(() => mainInput(page)).toEqual({ kind: 'value', value });
        expect((await events(page)).fields).toBe(before.fields + 1);
        expect((await events(page)).legacy).toBe(0);
        await expect(scope.getByTestId('optional-renderer')).toHaveAttribute(
            'data-envelope',
            'false',
        );
        await expect(draft).toHaveValue(value === null ? '' : String(value));
    }
    for (const [button, input] of [
        ['Unset Optional value', { kind: 'absent' }],
        ['Set null Optional value', { kind: 'value', value: null }],
        ['Set empty text Optional value', { kind: 'value', value: '' }],
    ]) {
        await scope.getByRole('button', { name: button, exact: true }).click();
        await expect.poll(() => mainInput(page)).toEqual(input);
        if (input.kind === 'absent') {
            await expect(fallback).toHaveValue('');
            await expect(scalar).toHaveCount(0);
        } else await expect(scalar).toHaveValue(input.value === null ? '0' : '1');
    }
    for (const [button, input, text] of [
        ['Use matching raw draft', { kind: 'raw', text: '01' }, '01'],
        ['Use unknown value', { kind: 'value', value: 'UNKNOWN' }, 'UNKNOWN'],
        ['Use incomplete draft', { kind: 'raw', text: 'invalid\npartial-' }, 'invalid\npartial-'],
        ['Use absent input', { kind: 'absent' }, ''],
    ]) {
        const counts = await events(page);
        await page.getByRole('button', { name: button, exact: true }).click();
        await expect.poll(() => mainInput(page)).toEqual(input);
        await expect(fallback).toHaveValue('');
        await expect(scalar).toHaveCount(0);
        await expect(draft).toHaveValue(text);
        expect(await events(page)).toEqual(counts);
        await unchanged(page, 'Refresh optional contexts');
    }
    await draft.fill('false');
    await expect.poll(() => mainInput(page)).toEqual({ kind: 'raw', text: 'false' });
    await expect(fallback).toHaveValue('');
    const before = await events(page);
    await fallback.selectOption('2');
    await expect.poll(() => mainInput(page)).toEqual({ kind: 'value', value: false });
    expect((await events(page)).fields).toBe(before.fields + 1);
    await expect(scalar).toHaveValue('2');
    const state = await snapshot(page),
        counts = await events(page);
    await scope.getByRole('button', { name: 'Probe out-of-domain output' }).click();
    expect(await snapshot(page)).toEqual(state);
    expect(await events(page)).toEqual(counts);
    await draft.fill('invalid\npartial');
    await expect(draft).toHaveAttribute('aria-invalid', 'true');
    for (const control of [draft, fallback]) {
        await expect(control).toHaveAttribute('aria-invalid', 'true');
        expect(
            await control.evaluate((el) =>
                el
                    .getAttribute('aria-describedby')
                    .split(' ')
                    .every((id) => !!document.getElementById(id)),
            ),
        ).toBe(true);
    }
});

test('optional request, domain, presentation and five themes preserve session state and logical focus', async ({
    page,
}) => {
    await open(page);
    const scope = header(page),
        scalar = scope.getByLabel('Optional value optional selection', { exact: true });
    const draft = scope.getByLabel('Optional value draft', { exact: true });
    const draftNode = await draft.elementHandle();
    for (const theme of themes) {
        const node = await scalar.elementHandle(),
            representation = await scope.getByTestId('optional-renderer').textContent();
        await scalar.focus();
        await unchanged(page, theme);
        await expect(scalar).toBeFocused();
        await expect(scalar).toHaveValue('5');
        if ((await scope.getByTestId('optional-renderer').textContent()) === representation)
            expect(await scalar.evaluate((el, old) => el === old, node)).toBe(true);
        await expect(scope.getByTestId('optional-renderer')).toHaveAttribute(
            'data-envelope',
            'false',
        );
    }
    await unchanged(page, 'default');
    await scalar.focus();
    await unchanged(page, 'Compact presentation');
    await expect(scope.getByTestId('optional-renderer')).toHaveText('alternative');
    await expect(scalar).toBeFocused();
    await draft.focus();
    for (const name of [
        'Toggle optional domain',
        'Toggle optional domain',
        'Toggle control identity',
        'Regular presentation',
        'Refresh optional contexts',
    ]) {
        await unchanged(page, name);
        await expect(draft).toBeFocused();
        expect(await draft.evaluate((el, old) => el === old, draftNode)).toBe(true);
    }
    await unchanged(page, 'Unavailable presentation');
    const fallback = scope.getByLabel('Optional value exact value', { exact: true });
    await expect(scalar).toHaveCount(0);
    await expect(fallback).toHaveValue('5');
    await expect(fallback.locator('option:checked')).toHaveText('Text "01"');
    const node = await fallback.elementHandle();
    for (const theme of themes) {
        await fallback.focus();
        await unchanged(page, theme);
        await expect(fallback).toBeFocused();
        expect(await fallback.evaluate((el, old) => el === old, node)).toBe(true);
    }
    const state = await snapshot(page),
        counts = await events(page);
    await fallback.evaluate((el) => {
        el.value = '';
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(fallback).toHaveValue('5');
    expect(await snapshot(page)).toEqual(state);
    expect(await events(page)).toEqual(counts);
    await fallback.selectOption('0');
    await expect.poll(() => mainInput(page)).toEqual({ kind: 'value', value: null });
    expect((await events(page)).fields).toBe(counts.fields + 1);
    await unchanged(page, 'Regular presentation');
    await expect(scalar).toHaveValue('0');
    // A raw value equal to an option never becomes a scalar value during theme refresh.
    await page.getByRole('button', { name: 'Use matching raw draft' }).click();
    await expect.poll(() => mainInput(page)).toEqual({ kind: 'raw', text: '01' });
    await draft.focus();
    for (const theme of themes) {
        await unchanged(page, theme);
        await expect(draft).toBeFocused();
        await expect(fallback).toHaveValue('');
    }
});

test('optional keyed rows, readonly/disabled controls and inherited restrictions use only the lossless channel', async ({
    page,
}) => {
    await open(page);
    const row = rowField(page),
        draft = row.getByLabel('Row optional — Row a draft', { exact: true });
    const scalar = row.getByLabel('Row optional — Row a optional selection', { exact: true });
    const node = await scalar.elementHandle();
    const before = await rowInput(page, 'b');
    await page.getByRole('button', { name: 'Reorder optional rows' }).click();
    expect(await scalar.evaluate((el, old) => el === old, node)).toBe(true);
    await scalar.selectOption('3');
    await expect.poll(() => rowInput(page)).toEqual({ kind: 'value', value: true });
    expect(await rowInput(page, 'b')).toEqual(before);
    expect((await events(page)).last.key).toBe('a');
    expect((await events(page)).cells).toBe(1);
    await draft.fill('incomplete-');
    await expect.poll(() => rowInput(page)).toEqual({ kind: 'raw', text: 'incomplete-' });
    const draftNode = await draft.elementHandle();
    for (const theme of themes) {
        await draft.focus();
        await unchanged(page, theme);
        await expect(draft).toBeFocused();
        expect(await draft.evaluate((el, old) => el === old, draftNode)).toBe(true);
    }
    const counts = await events(page),
        state = await snapshot(page);
    for (const id of ['fixed', 'disabled']) {
        const scope = page.locator(`aur-form-field[data-aur-field="${id}"]`);
        await expect(scope.locator('select')).toBeDisabled();
        await scope
            .getByRole('button', { name: 'Probe scalar output', exact: true })
            .evaluate((el) => el.click());
        await scope.locator('textarea').evaluate((el) => {
            el.value = 'ignored';
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }
    expect(await snapshot(page)).toEqual(state);
    expect(await events(page)).toEqual(counts);
    await unchanged(page, 'Toggle optional domain');
    for (const id of ['fixed', 'disabled']) {
        const control = page.locator(`aur-form-field[data-aur-field="${id}"] select`);
        await expect(control).toBeDisabled();
        await control.evaluate((el) => {
            el.value = '1';
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await expect(control).toHaveValue('');
    }
    expect(await snapshot(page)).toEqual(state);
    expect(await events(page)).toEqual(counts);
    await unchanged(page, 'Toggle editor read-only');
    await expect(draft).toHaveJSProperty('readOnly', true);
    await draft.evaluate((el) => {
        el.value = 'ignored';
        el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await row.getByLabel('Row optional — Row a exact value', { exact: true }).evaluate((el) => {
        el.value = '2';
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(await snapshot(page)).toEqual(state);
    expect(await events(page)).toEqual(counts);
    await unchanged(page, 'Toggle editor read-only');
    await unchanged(page, 'Toggle optional domain');
    await page.getByRole('button', { name: 'Use matching raw draft' }).click();
    await expect.poll(() => rowInput(page)).toEqual({ kind: 'raw', text: '01' });
    const fallback = row.getByLabel('Row optional — Row a exact value', { exact: true });
    await fallback.selectOption('4');
    await expect.poll(() => rowInput(page)).toEqual({ kind: 'value', value: 'false' });
    expect((await events(page)).last.key).toBe('a');
    expect((await events(page)).legacy).toBe(0);
});

test('legacy optional controls retain scalar events and original context contracts through five themes', async ({
    page,
}) => {
    await open(page);
    const scope = page.locator('aur-form-field[data-aur-field="legacy"]');
    const scalar = scope.getByLabel('Legacy optional optional selection', { exact: true });
    for (const [index, theme] of themes.entries()) {
        await unchanged(page, theme);
        await expect(scope.getByTestId('optional-renderer')).toHaveAttribute(
            'data-envelope',
            'false',
        );
        await scalar.selectOption(index % 2 ? '2' : '4');
        await expect
            .poll(async () => JSON.parse(await page.getByTestId('optional-legacy').textContent()))
            .toEqual({ value: index % 2 ? false : 'false', events: index + 1 });
        await expect(scope.locator('aur-document-control')).toHaveCount(0);
    }
    expect((await events(page)).legacy).toBe(0);
    expect((await events(page)).fields).toBe(0);
});
