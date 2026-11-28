import { test, expect } from '@playwright/test';
import {
    scalarContract,
    snapshot,
    events,
    mainInput,
    retained,
} from '../editor-scalar-helpers.mjs';

test('DATETIME text preserves explicit offsets and fractional spelling in headers and keyed cells', async ({
    page,
}) => {
    await scalarContract(
        page,
        'datetime',
        [
            ['', true],
            ['2024-03-01T12:', true],
            ['2024-03-01T12:30:00.1234567+', true],
            ['2024-03-01T12:30:00', true],
            ['2024-03-01T12:30:00z', true],
            ['2024-03-01T12:30:00+14:01', true],
            ['2024-03-01T12:30:00.12345678Z', true],
            [' 2024-03-01T12:30:00Z ', true],
            ...['Z', '+00:00', '-00:00', '+05:45', '-03:30', '+14:00', '-14:00'].map((offset) => [
                '2024-03-01T12:30:00' + offset,
                false,
            ]),
            ...Array.from({ length: 7 }, (_, i) => [
                '2024-03-01T12:30:00.' + '1234567'.slice(0, i + 1) + '+01:00',
                false,
            ]),
            ['2024-03-01T12:30:00.1000000-00:00', false],
        ],
        async (page) => {
            await page.getByRole('button', { name: 'Toggle instant bounds' }).click();
            await expect(
                page.locator('input[type=datetime-local],input[type=date],input[type=time]'),
            ).toHaveCount(0);
        },
    );
});

test('DATETIME exact offset-instant constraints refresh without native conversion or document mutation', async ({
    page,
}) => {
    await page.goto('/default-theme/?scenario=scalar-editor&type=datetime');
    const text = page.getByLabel('Scalar value', { exact: true });
    const row = page.getByLabel('Row scalar — Row a', { exact: true });
    for (const control of [text, row]) {
        for (const [value, invalid] of [
            ['2024-03-01T13:30:00.1234567+01:00', true],
            ['2024-03-01T09:00:00.1234568-03:30', false],
            ['2024-03-01T18:15:00.1234569+05:45', true],
        ]) {
            await control.fill(value);
            if (invalid) await expect(control).toHaveAttribute('aria-invalid', 'true');
            else await expect(control).not.toHaveAttribute('aria-invalid', 'true');
            await expect(control).toHaveValue(value);
        }
    }
    const state = await snapshot(page),
        counts = await events(page);
    await page.getByRole('button', { name: 'Toggle instant bounds' }).click();
    await expect(text).not.toHaveAttribute('aria-invalid', 'true');
    await expect(row).not.toHaveAttribute('aria-invalid', 'true');
    await retained(page, [text, row]);
    const node = await text.elementHandle();
    await text.focus();
    await page
        .getByRole('button', { name: 'DATETIME whole seconds', exact: true })
        .evaluate((el) => el.click());
    await expect(text).toHaveAttribute('aria-invalid', 'true');
    await expect(row).toHaveAttribute('aria-invalid', 'true');
    await expect(text).toBeFocused();
    expect(await text.evaluate((el, old) => el === old, node)).toBe(true);
    expect(await snapshot(page)).toEqual(state);
    expect(await events(page)).toEqual(counts);
    await page.getByRole('button', { name: 'DATETIME seven fraction digits' }).click();
    await expect(text).not.toHaveAttribute('aria-invalid', 'true');
    expect(await snapshot(page)).toEqual(state);
    expect(await events(page)).toEqual(counts);
    expect(await mainInput(page)).toEqual({
        kind: 'raw',
        text: '2024-03-01T18:15:00.1234569+05:45',
    });
    // A native change event on this text control is not an editing intent.
    await text.dispatchEvent('change');
    expect(await events(page)).toEqual(counts);
});
