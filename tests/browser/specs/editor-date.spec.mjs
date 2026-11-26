import { test, expect } from '@playwright/test';
const snapshot = async (page) =>
    JSON.parse(await page.getByTestId('editor-snapshot').textContent());
const events = async (page) => JSON.parse(await page.getByTestId('enum-events').textContent());
const input = async (page) => (await snapshot(page)).properties.date.input;
const themes = ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast'];

test('lossless DATE keeps raw drafts beside native selection, with one channel and retained focus', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/default-theme/?scenario=editor');
    const text = page.getByLabel('Document date', { exact: true });
    const native = page.getByLabel('Document date date selection', { exact: true });
    await expect(text).toHaveAttribute('type', 'text');
    await expect(native).toHaveAttribute('type', 'date');
    await expect(text).toHaveValue('2024-02-29');
    await expect(native).toHaveValue('2024-02-29');
    expect(await events(page)).toEqual({ fields: 0, cells: 0, legacy: 0, last: null });
    expect(await input(page)).toEqual({ kind: 'value', value: '2024-02-29' });

    for (const [button, slot] of [
        ['Unset Document date', { kind: 'absent' }],
        ['Set null Document date', { kind: 'value', value: null }],
        ['Set empty text Document date', { kind: 'value', value: '' }],
    ]) {
        const before = await events(page);
        await page.getByRole('button', { name: button, exact: true }).click();
        await expect.poll(() => input(page)).toEqual(slot);
        expect((await events(page)).fields).toBe(before.fields + 1);
        await expect(text).toHaveValue('');
        await expect(native).toHaveValue('');
    }
    for (const value of [
        '',
        '2024-02-',
        '2025-02-29',
        '1900-02-29',
        '2024-2-09',
        ' 2024-02-29 ',
        '２０２４-02-29',
        '0000-01-01',
        '10000-01-01',
        '0001-01-01',
        '9999-12-31',
        '2000-02-29',
        '2024-02-29',
        '2025-02-28',
    ]) {
        const before = await events(page);
        if (value === '') await text.dispatchEvent('input');
        else await text.fill(value);
        await expect.poll(() => input(page)).toEqual({ kind: 'raw', text: value });
        await expect.poll(async () => (await events(page)).fields).toBe(before.fields + 1);
        await expect(text).toHaveValue(value);
        const representable = [
            '0001-01-01',
            '9999-12-31',
            '2000-02-29',
            '2024-02-29',
            '2025-02-28',
        ].includes(value);
        await expect(native).toHaveValue(representable ? value : '');
    }
    for (const [button, slot, displayed] of [
        ['Use invalid DATE', { kind: 'value', value: '2025-02-29' }, '2025-02-29'],
        ['Use unsupported DATE', { kind: 'value', value: false }, 'false'],
    ]) {
        const before = await events(page);
        await page.getByRole('button', { name: button, exact: true }).click();
        await expect.poll(() => input(page)).toEqual(slot);
        await expect(text).toHaveValue(displayed);
        await expect(native).toHaveValue('');
        expect(await events(page)).toEqual(before);
    }
    await text.fill('2024-02-');
    await expect(text).toHaveAttribute('aria-invalid', 'true');
    for (const control of [text, native]) {
        expect(
            await control.evaluate((el) =>
                el
                    .getAttribute('aria-describedby')
                    .split(' ')
                    .every((id) => !!document.getElementById(id)),
            ),
        ).toBe(true);
        await expect(control).toHaveAttribute('aria-invalid', 'true');
        const node = await control.elementHandle();
        for (const theme of themes) {
            await control.focus();
            const before = await snapshot(page),
                counts = await events(page);
            await page
                .getByRole('button', { name: theme, exact: true })
                .evaluate((el) => el.click());
            await expect(control).toBeFocused();
            expect(await control.evaluate((el, old) => el === old, node)).toBe(true);
            expect(await snapshot(page)).toEqual(before);
            expect(await events(page)).toEqual(counts);
            await expect(text).toHaveValue('2024-02-');
        }
    }
    for (const theme of themes) {
        await page.getByRole('button', { name: theme, exact: true }).click();
        const before = await events(page);
        await native.fill('2024-03-01');
        await expect.poll(() => input(page)).toEqual({ kind: 'raw', text: '2024-03-01' });
        await expect.poll(async () => (await events(page)).fields).toBe(before.fields + 1);
        await native.dispatchEvent('change');
        expect((await events(page)).fields).toBe(before.fields + 1);
        await expect(text).toHaveValue('2024-03-01');
        await expect(native).toBeFocused();
        const unchanged = await snapshot(page),
            counts = await events(page);
        await native.fill('');
        expect(await snapshot(page)).toEqual(unchanged);
        expect(await events(page)).toEqual(counts);
        await expect(text).toHaveValue('2024-03-01');
    }
    // The validator reports declared bounds; the native chooser does not invent a bound contract.
    await native.fill('2026-01-01');
    await expect.poll(() => input(page)).toEqual({ kind: 'raw', text: '2026-01-01' });
    await expect(native).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#editor-date-feedback')).toContainText('maximum');
    const blocked = await snapshot(page),
        counts = await events(page);
    for (const name of ['Fixed date', 'Disabled date']) {
        for (const label of [name, name + ' date selection']) {
            const control = page.getByLabel(label, { exact: true });
            await expect(control).toHaveJSProperty(
                name === 'Fixed date' ? 'readOnly' : 'disabled',
                true,
            );
            await control.evaluate((el) => {
                el.value = '2024-04-01';
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
            });
        }
    }
    expect(await snapshot(page)).toEqual(blocked);
    expect(await events(page)).toEqual(counts);

    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    await page.getByRole('button', { name: 'First section', exact: true }).click();
    const cellText = page.getByLabel('Row date — Row a', { exact: true });
    const cellNative = page.getByLabel('Row date — Row a date selection', { exact: true });
    await expect(cellText).toHaveValue('false');
    await expect(cellNative).toHaveValue('');
    await cellText.fill('2025-02-29');
    await expect(cellText).toHaveAttribute('aria-invalid', 'true');
    for (const theme of themes) {
        const node = await cellNative.elementHandle();
        await cellNative.focus();
        const before = await events(page),
            state = await snapshot(page);
        await page.getByRole('button', { name: theme, exact: true }).evaluate((el) => el.click());
        await expect(cellNative).toBeFocused();
        expect(await cellNative.evaluate((el, old) => el === old, node)).toBe(true);
        expect(await snapshot(page)).toEqual(state);
        expect(await events(page)).toEqual(before);
        await cellNative.fill('2024-02-29');
        await expect.poll(async () => (await events(page)).cells).toBe(before.cells + 1);
        expect((await events(page)).last).toMatchObject({
            collectionId: 'first',
            key: 'a',
            field: 'date',
            path: [
                { kind: 'property', name: 'details' },
                { kind: 'property', name: 'first' },
                { kind: 'row', key: 'a' },
                { kind: 'property', name: 'date' },
            ],
            input: { kind: 'raw', text: '2024-02-29' },
        });
        await expect(cellText).toHaveValue('2024-02-29');
        expect((await events(page)).legacy).toBe(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await cellText.fill('2024-02-');
    }
    await page.getByRole('button', { name: 'Move down Row a', exact: true }).click();
    await expect(cellText).toHaveValue('2024-02-');
    expect(errors).toEqual([]);
});

test('DATE native bounds follow changing field constraints without clamping header or keyed drafts', async ({
    page,
}) => {
    await page.goto('/default-theme/?scenario=editor');
    const text = page.getByLabel('Document date', { exact: true });
    const native = page.getByLabel('Document date date selection', { exact: true });
    await expect(native).toHaveAttribute('min', '2024-01-01');
    await expect(native).toHaveAttribute('max', '2025-12-31');
    await text.fill('2024-02-27');
    await expect.poll(() => input(page)).toEqual({ kind: 'raw', text: '2024-02-27' });
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    await page.getByRole('button', { name: 'First section', exact: true }).click();
    const cellText = page.getByLabel('Row date — Row a', { exact: true });
    const cellNative = page.getByLabel('Row date — Row a date selection', { exact: true });
    await cellText.fill('2024-03-02');
    await expect
        .poll(async () => (await events(page)).last.input)
        .toEqual({ kind: 'raw', text: '2024-03-02' });
    const before = await snapshot(page),
        counts = await events(page);
    const node = await cellNative.elementHandle();
    for (const [button, min, max, underflow, overflow] of [
        ['DATE no bounds', '0001-01-01', '9999-12-31', false, false],
        ['DATE minimum only', '2024-02-28', '9999-12-31', true, false],
        ['DATE maximum only', '0001-01-01', '2024-03-01', false, true],
        ['DATE combined bounds', '2024-02-28', '2024-03-01', true, true],
        ['DATE exclusive bounds', '2024-02-29', '2024-02-29', true, true],
        ['DATE no bounds', '0001-01-01', '9999-12-31', false, false],
    ]) {
        await cellNative.focus();
        await page.getByRole('button', { name: button, exact: true }).evaluate((el) => el.click());
        for (const control of [native, cellNative]) {
            await expect(control).toHaveAttribute('min', min);
            await expect(control).toHaveAttribute('max', max);
        }
        expect(await native.evaluate((el) => el.validity.rangeUnderflow)).toBe(underflow);
        expect(await cellNative.evaluate((el) => el.validity.rangeOverflow)).toBe(overflow);
        await expect(cellNative).toBeFocused();
        expect(await cellNative.evaluate((el, old) => el === old, node)).toBe(true);
        await expect(text).toHaveValue('2024-02-27');
        await expect(cellText).toHaveValue('2024-03-02');
        expect(await snapshot(page)).toEqual(before);
        expect(await events(page)).toEqual(counts);
    }
    await cellText.fill('2024-02-');
    await page.getByRole('button', { name: 'DATE exclusive bounds', exact: true }).click();
    await expect(cellNative).toHaveAttribute('min', '2024-02-29');
    await expect(cellText).toHaveValue('2024-02-');
    await expect(cellNative).toHaveValue('');
    // Native hints do not replace validation or reject a retained out-of-range raw intent.
    await cellNative.fill('2024-02-28');
    await expect(cellText).toHaveValue('2024-02-28');
    await expect(cellNative).toHaveAttribute('aria-invalid', 'true');
    expect(await cellNative.evaluate((el) => el.validity.rangeUnderflow)).toBe(true);
    await cellNative.fill('2024-02-29');
    await expect(cellText).toHaveValue('2024-02-29');
    await expect(cellNative).not.toHaveAttribute('aria-invalid', 'true');
});
