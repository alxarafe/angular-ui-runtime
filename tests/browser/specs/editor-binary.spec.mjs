import { test, expect } from '@playwright/test';
import {
    scalarContract,
    snapshot,
    events,
    mainInput,
    retained,
} from '../editor-scalar-helpers.mjs';

test('BINARY Base64 uses lossless text for canonical, incomplete and invalid multiline drafts', async ({
    page,
}) => {
    await scalarContract(
        page,
        'binary',
        [
            ['', false],
            ['Zg==', false],
            ['Zm8=', false],
            ['Zm9v', false],
            ['Zm9vYmFy', false],
            ['+/8=', false],
            ['Zg', true],
            ['Zg=', true],
            ['Zh==', true],
            ['Zm9=', true],
            ['Zg===', true],
            ['-_8=', true],
            [' Zg== ', true],
            ['Zg==\n', true],
            ['\tZg==', true],
            ['e\u0301', true],
            ['Zm9vYmFy', false],
        ],
        undefined,
        'textarea',
    );
    await expect(page.locator('input[type=file]')).toHaveCount(0);
});

test('BINARY presence metadata and CRLF rendering retain exact session slots without conversion', async ({
    page,
}) => {
    await page.goto('/default-theme/?scenario=scalar-editor&type=binary');
    const text = page.getByLabel('Scalar value', { exact: true });
    await page.getByRole('button', { name: 'Use CRLF Base64 draft' }).click();
    await expect.poll(() => mainInput(page)).toEqual({ kind: 'raw', text: 'Zg==\r\n' });
    // Native textarea display folds CRLF; rendering and refresh never write that projection back.
    await expect(text).toHaveValue('Zg==\n');
    await retained(page, [text]);
    await expect.poll(() => mainInput(page)).toEqual({ kind: 'raw', text: 'Zg==\r\n' });
    expect((await events(page)).fields).toBe(0);
    for (const [button, slot, policy] of [
        ['Unset Scalar value', { kind: 'absent' }, 'Toggle BINARY required'],
        ['Set null Scalar value', { kind: 'value', value: null }, 'Toggle BINARY nullable'],
    ]) {
        await page.getByRole('button', { name: button, exact: true }).click();
        await expect.poll(() => mainInput(page)).toEqual(slot);
        await expect(text).not.toHaveAttribute('aria-invalid', 'true');
        const before = await snapshot(page),
            counts = await events(page),
            node = await text.elementHandle();
        await text.focus();
        await page.getByRole('button', { name: policy, exact: true }).evaluate((el) => el.click());
        await expect(text).toHaveAttribute('aria-invalid', 'true');
        await expect(text).toBeFocused();
        expect(await text.evaluate((el, old) => el === old, node)).toBe(true);
        expect(await snapshot(page)).toEqual(before);
        expect(await events(page)).toEqual(counts);
    }
    await page.getByRole('button', { name: 'Set empty text Scalar value', exact: true }).click();
    await expect.poll(() => mainInput(page)).toEqual({ kind: 'value', value: '' });
    await text.dispatchEvent('input');
    await expect.poll(() => mainInput(page)).toEqual({ kind: 'raw', text: '' });
    await expect(text).not.toHaveAttribute('aria-invalid', 'true');
    const before = await snapshot(page),
        counts = await events(page);
    await text.dispatchEvent('change');
    await page.getByRole('button', { name: 'Refresh scalar contexts' }).click();
    expect(await snapshot(page)).toEqual(before);
    expect(await events(page)).toEqual(counts);
    expect(counts.legacy).toBe(0);
});
