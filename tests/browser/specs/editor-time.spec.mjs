import { test, expect } from '@playwright/test';
import {
    scalarContract,
    snapshot,
    events,
    mainInput,
    rowInput,
    retained,
} from '../editor-scalar-helpers.mjs';

test('TIME text retains exact fractions and invalid drafts through keyed rows and five themes', async ({
    page,
}) => {
    await scalarContract(
        page,
        'time',
        [
            ['', true],
            ['12:', true],
            ['12:30', true],
            ['12:30:00.', true],
            ['24:00:00', true],
            ['12:30:00Z', true],
            ['12:30:00.12345678', true],
            [' 12:30:00 ', true],
            ...Array.from({ length: 7 }, (_, i) => [
                '12:30:00.' + '1234567'.slice(0, i + 1),
                false,
            ]),
            ['09:00:00', true],
            ['18:00:00', true],
            ['12:30:00.1000000', false],
        ],
        async (page) => {
            await page.getByRole('button', { name: 'Seven fraction digits' }).click();
            await expect(page.locator('input[type=time]')).toHaveCount(0);
        },
    );
});

test('whole-second TIME native assistance restores ignored edits and leaves bounds validation authoritative', async ({
    page,
}) => {
    await page.goto('/default-theme/?scenario=scalar-editor&type=time');
    const text = page.getByLabel('Scalar value', { exact: true });
    const native = page.getByLabel('Scalar value time selection', { exact: true });
    const row = page.getByLabel('Row scalar — Row a time selection', { exact: true });
    await expect(native).toHaveAttribute('step', '1');
    await expect(native).toHaveAttribute('min', '09:00:01');
    await expect(native).toHaveAttribute('max', '17:59:59');
    await native.fill('13:25:16');
    await expect.poll(() => mainInput(page)).toEqual({ kind: 'raw', text: '13:25:16' });
    await expect(text).toHaveValue('13:25:16');
    expect((await events(page)).fields).toBe(1);
    await native.dispatchEvent('change');
    expect((await events(page)).fields).toBe(1);
    await retained(page, [native, row]);
    const node = await native.elementHandle();
    for (const value of ['', 'invalid', '12:30:00.123']) {
        await native.focus();
        const before = await snapshot(page),
            counts = await events(page);
        await native.evaluate((el, value) => {
            el.value = value;
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }, value);
        await expect(native).toHaveValue('13:25:16');
        await expect(native).toBeFocused();
        expect(await native.evaluate((el, old) => el === old, node)).toBe(true);
        expect(await snapshot(page)).toEqual(before);
        expect(await events(page)).toEqual(counts);
    }
    // A native minute choice explicitly represents zero seconds in the document grammar.
    await native.fill('14:35');
    await expect.poll(() => mainInput(page)).toEqual({ kind: 'raw', text: '14:35:00' });
    await row.fill('15:40:17');
    await expect.poll(() => rowInput(page)).toEqual({ kind: 'raw', text: '15:40:17' });
    expect((await events(page)).last.key).toBe('a');
    await native.fill('18:00:00');
    await expect.poll(() => mainInput(page)).toEqual({ kind: 'raw', text: '18:00:00' });
    await expect(native).toHaveAttribute('aria-invalid', 'true');
    const state = await snapshot(page),
        counts = await events(page);
    for (const label of ['Fixed scalar time selection', 'Disabled scalar time selection']) {
        await page.getByLabel(label, { exact: true }).evaluate((el) => {
            el.value = '16:00:01';
            el.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }
    expect(await snapshot(page)).toEqual(state);
    expect(await events(page)).toEqual(counts);
    await page.getByRole('button', { name: 'Toggle time bounds' }).click();
    await expect(native).toHaveAttribute('min', '00:00:00');
    await expect(native).toHaveAttribute('max', '23:59:59');
    expect(await snapshot(page)).toEqual(state);
    expect(await events(page)).toEqual(counts);
    await text.fill('12:30:00.1234567');
    const raw = await snapshot(page),
        rawCounts = await events(page);
    await expect(native).toHaveValue('');
    await native.dispatchEvent('input');
    expect(await snapshot(page)).toEqual(raw);
    expect(await events(page)).toEqual(rawCounts);
    await page.getByRole('button', { name: 'Seven fraction digits' }).click();
    await expect(page.locator('input[type=time]')).toHaveCount(0);
    await expect(text).toHaveValue('12:30:00.1234567');
    expect(await snapshot(page)).toEqual(raw);
    expect(await events(page)).toEqual(rawCounts);
    await page.getByRole('button', { name: 'Whole seconds', exact: true }).click();
    await expect(text).toHaveValue('12:30:00.1234567');
    expect(await snapshot(page)).toEqual(raw);
    expect((await events(page)).legacy).toBe(0);
});
