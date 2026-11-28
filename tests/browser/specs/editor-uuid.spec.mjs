import { test, expect } from '@playwright/test';
import {
    scalarContract,
    snapshot,
    events,
    mainInput,
    rowInput,
    retained,
} from '../editor-scalar-helpers.mjs';
const lower = '123e4567-e89b-12d3-a456-426614174000';
const mixed = '123E4567-e89B-12d3-A456-426614174000';

test('UUID lossless text retains casing and invalid drafts in headers and keyed rows', async ({
    page,
}) => {
    await scalarContract(page, 'uuid', [
        ['', true],
        ['123e4567-', true],
        ['not-a-uuid', true],
        ['{' + lower + '}', true],
        [lower.replaceAll('-', ''), true],
        [' ' + lower + ' ', true],
        ['123g4567-e89b-12d3-a456-426614174000', true],
        [lower, false],
        [lower.toUpperCase(), false],
        ['00000000-0000-0000-0000-000000000000', false],
        ['ffffffff-ffff-ffff-ffff-ffffffffffff', false],
        [mixed, false],
    ]);
});

test('UUID lower/either metadata updates validation without normalization or focus replacement', async ({
    page,
}) => {
    await page.goto('/default-theme/?scenario=scalar-editor&type=uuid');
    const text = page.getByLabel('Scalar value', { exact: true });
    const row = page.getByLabel('Row scalar — Row a', { exact: true });
    for (const control of [text, row]) await control.fill(mixed);
    const state = await snapshot(page),
        counts = await events(page);
    for (const [name, invalid] of [
        ['Lower UUID casing', true],
        ['Either UUID casing', false],
    ]) {
        await page.getByRole('button', { name, exact: true }).click();
        for (const control of [text, row]) {
            await expect(control).toHaveValue(mixed);
            if (invalid) await expect(control).toHaveAttribute('aria-invalid', 'true');
            else await expect(control).not.toHaveAttribute('aria-invalid', 'true');
        }
        await retained(page, [text, row]);
        expect(await snapshot(page)).toEqual(state);
        expect(await events(page)).toEqual(counts);
    }
    expect(await mainInput(page)).toEqual({ kind: 'raw', text: mixed });
    expect(await rowInput(page)).toEqual({ kind: 'raw', text: mixed });
    await text.dispatchEvent('change');
    expect(await events(page)).toEqual(counts);
    await expect(page.locator('input[type=time],input[type=date],input[type=file]')).toHaveCount(0);
});
