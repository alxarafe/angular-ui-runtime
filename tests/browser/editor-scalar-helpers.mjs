import { expect } from '@playwright/test';
export const themes = ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast'];
export const snapshot = async (page) =>
    JSON.parse(await page.getByTestId('scalar-snapshot').textContent());
export const events = async (page) =>
    JSON.parse(await page.getByTestId('scalar-events').textContent());
export const mainInput = async (page) => (await snapshot(page)).current.properties.main.input;
export const rowInput = async (page, key = 'a') =>
    (await snapshot(page)).current.properties.rows.rows.find((row) => row.key === key).value
        .properties.value.input;
export async function retained(page, controls) {
    for (const control of controls) {
        const node = await control.elementHandle();
        for (const theme of themes) {
            await control.focus();
            const state = await snapshot(page),
                counts = await events(page),
                value = await control.inputValue();
            await page
                .getByRole('button', { name: theme, exact: true })
                .evaluate((el) => el.click());
            await page
                .getByRole('button', { name: 'Refresh scalar contexts', exact: true })
                .evaluate((el) => el.click());
            await expect(control).toBeFocused();
            expect(await control.evaluate((el, old) => el === old, node)).toBe(true);
            await expect(control).toHaveValue(value);
            expect(await snapshot(page)).toEqual(state);
            expect(await events(page)).toEqual(counts);
        }
    }
}
export async function scalarContract(page, type, cases, setup = async () => {}) {
    await page.goto(`/default-theme/?scenario=scalar-editor&type=${type}`);
    await setup(page);
    const text = page.getByLabel('Scalar value', { exact: true });
    const row = page.getByLabel('Row scalar — Row a', { exact: true });
    expect(await events(page)).toEqual({ fields: 0, cells: 0, legacy: 0, last: null });
    await expect(text).toHaveAttribute('type', 'text');
    for (const [button, slot] of [
        ['Unset Scalar value', { kind: 'absent' }],
        ['Set null Scalar value', { kind: 'value', value: null }],
        ['Set empty text Scalar value', { kind: 'value', value: '' }],
    ]) {
        await page.getByRole('button', { name: button, exact: true }).click();
        await expect.poll(() => mainInput(page)).toEqual(slot);
        await expect(text).toHaveValue('');
    }
    for (const [value, invalid] of cases) {
        for (const [control, read, count] of [
            [text, mainInput, 'fields'],
            [row, rowInput, 'cells'],
        ]) {
            const before = await events(page);
            // Dispatch input explicitly even for an unchanged empty DOM value.
            await control.evaluate((el, value) => {
                el.value = value;
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }, value);
            await expect.poll(() => read(page)).toEqual({ kind: 'raw', text: value });
            await expect(control).toHaveValue(value);
            expect((await events(page))[count]).toBe(before[count] + 1);
            if (invalid) await expect(control).toHaveAttribute('aria-invalid', 'true');
            else await expect(control).not.toHaveAttribute('aria-invalid', 'true');
        }
    }
    await retained(page, [text, row]);
    const node = await row.elementHandle(),
        originalB = await rowInput(page, 'b');
    await page.getByRole('button', { name: 'Reorder scalar rows' }).click();
    expect(await row.evaluate((el, old) => el === old, node)).toBe(true);
    await row.fill(cases[0][0] || 'invalid');
    expect(await rowInput(page, 'b')).toEqual(originalB);
    expect((await events(page)).last.key).toBe('a');
    for (const control of [text, row]) {
        const ids = await control.getAttribute('aria-describedby');
        expect(ids).toBeTruthy();
        expect(
            await control.evaluate((el) =>
                el
                    .getAttribute('aria-describedby')
                    .split(' ')
                    .every((id) => !!document.getElementById(id)),
            ),
        ).toBe(true);
    }
    const before = await snapshot(page),
        counts = await events(page);
    for (const name of ['Fixed scalar', 'Disabled scalar']) {
        const control = page.getByLabel(name, { exact: true });
        await expect(control).toHaveJSProperty(
            name === 'Fixed scalar' ? 'readOnly' : 'disabled',
            true,
        );
        await control.evaluate((el) => {
            el.value = 'ignored';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }
    expect(await snapshot(page)).toEqual(before);
    expect(await events(page)).toEqual(counts);
    await page.getByRole('button', { name: 'Use unsupported scalar' }).click();
    await expect(text).toHaveValue('false');
    expect(await mainInput(page)).toEqual({ kind: 'value', value: false });
    expect(await events(page)).toEqual(counts);
    await retained(page, [text]);
    expect((await events(page)).legacy).toBe(0);
    return { text, row };
}
