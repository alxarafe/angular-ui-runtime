import { test, expect } from '@playwright/test';
const themes = ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast'];
const opaque = 'opaque /?#" e\u0301';
const state = async (page) => JSON.parse(await page.getByTestId('selector-state').textContent());
const events = async (page) => JSON.parse(await page.getByTestId('selector-events').textContent());
const input = async (page) => (await state(page)).properties.choice.input;
const header = (page) => page.getByRole('combobox', { name: 'Header choice', exact: true });
const field = (page) => page.locator('[data-aur-form-field][data-aur-field="choice"]');
test('paged selector retains controlled values and focus through refresh, loading and five themes', async ({
    page,
}) => {
    const errors = [],
        requests = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('request', (request) => {
        if (['fetch', 'xhr'].includes(request.resourceType())) requests.push(request.url());
    });
    await page.goto('/default-theme/?scenario=selector');
    const select = header(page);
    await expect(select.locator('option:checked')).toHaveText('Current: Current outside');
    expect((await events(page)).edits).toBe(0);
    const defaultHeight = await select.evaluate((el) => el.getBoundingClientRect().height);
    for (const theme of themes) {
        await page.getByRole('button', { name: 'Apply page A', exact: true }).click();
        await select.focus();
        const before = await state(page),
            count = (await events(page)).edits,
            node = await select.elementHandle();
        await page.getByRole('button', { name: theme, exact: true }).evaluate((el) => el.click());
        await expect(select).toBeFocused();
        expect(await select.evaluate((el, old) => el === old, node)).toBe(true);
        expect(await state(page)).toEqual(before);
        expect((await events(page)).edits).toBe(count);
        const value = theme === 'alternative' || theme === 'vintage' ? '9007199254740993' : opaque;
        await select.selectOption({ value });
        await expect.poll(() => input(page)).toEqual({ kind: 'value', value });
        await expect.poll(async () => (await events(page)).edits).toBe(count + 1);
        await expect(select.locator('option:checked')).toHaveText('Repeated');
        await field(page).getByRole('button', { name: 'Next choices', exact: true }).click();
        await expect
            .poll(async () => (await events(page)).page)
            .toEqual({
                id: 'choice',
                path: [{ kind: 'property', name: 'choice' }],
                direction: 'next',
            });
        const selected = await state(page),
            selectedCount = (await events(page)).edits;
        await select.focus();
        for (const button of ['Apply page B', 'Busy page', 'Fail page', 'Apply page A']) {
            await page
                .getByRole('button', { name: button, exact: true })
                .evaluate((el) => el.click());
            await expect(select).toBeFocused();
            expect(await select.evaluate((el, old) => el === old, node)).toBe(true);
            await expect(select).toHaveValue(value);
            expect(await state(page)).toEqual(selected);
            expect((await events(page)).edits).toBe(selectedCount);
            if (button === 'Apply page B') {
                await field(page)
                    .getByRole('button', { name: 'Previous choices', exact: true })
                    .click();
                await expect
                    .poll(async () => (await events(page)).page)
                    .toEqual({
                        id: 'choice',
                        path: [{ kind: 'property', name: 'choice' }],
                        direction: 'previous',
                    });
                await select.focus();
            }
            if (button === 'Busy page') {
                await expect(select).toHaveAttribute('aria-busy', 'true');
                await expect(
                    field(page).getByRole('button', { name: 'Previous choices' }),
                ).toBeDisabled();
            }
            if (button === 'Fail page') {
                await expect(page.locator('#header-choice-choices-error')).toHaveText(
                    'Choices unavailable',
                );
                await expect(select).toHaveAttribute(
                    'aria-describedby',
                    /header-choice-choices-error/,
                );
            }
        }
        if (theme === 'high-contrast')
            expect(
                await select.evaluate((el) => el.getBoundingClientRect().height),
            ).toBeGreaterThan(defaultHeight);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    }
    for (const button of ['Read only selectors', 'Disable selectors']) {
        await page.getByRole('button', { name: button, exact: true }).click();
        await expect(select).toBeDisabled();
        const before = await state(page),
            count = (await events(page)).edits;
        await select.evaluate((el) => {
            el.selectedIndex = 1;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        expect(await state(page)).toEqual(before);
        expect((await events(page)).edits).toBe(count);
    }
    expect((await events(page)).unexpected).toBe(0);
    expect(errors).toEqual([]);
    expect(requests).toEqual([]);
});
test('selector separates legacy and lossless states and forwards keyed grid page/edit intents', async ({
    page,
}) => {
    await page.goto('/default-theme/?scenario=selector');
    const ordinary = page.getByRole('combobox', { name: 'Ordinary choice', exact: true });
    await ordinary.selectOption({ value: '' });
    await ordinary.selectOption({ value: '9007199254740993' });
    await page.getByRole('button', { name: 'Set null Ordinary choice', exact: true }).click();
    await expect
        .poll(async () => (await events(page)).legacy)
        .toEqual(['', '9007199254740993', null]);
    expect((await events(page)).edits).toBe(0);
    await expect(
        page.getByRole('button', { name: 'Unset Ordinary choice', exact: true }),
    ).toHaveCount(0);
    for (const [button, expected] of [
        ['Unset Header choice', { kind: 'absent' }],
        ['Set null Header choice', { kind: 'value', value: null }],
        ['Set empty text Header choice', { kind: 'value', value: '' }],
    ]) {
        await page.getByRole('button', { name: button, exact: true }).click();
        await expect.poll(() => input(page)).toEqual(expected);
    }
    await page.getByRole('button', { name: 'Unknown selection', exact: true }).click();
    const draft = page.getByRole('textbox', { name: 'Header choice draft', exact: true });
    await expect(draft).toHaveValue('UNKNOWN');
    await expect(header(page).locator('option:checked')).toContainText('Unknown');
    await page.getByRole('button', { name: 'Raw selection', exact: true }).click();
    await expect(draft).toHaveValue('invalid draft');
    await draft.fill('');
    await expect.poll(() => input(page)).toEqual({ kind: 'raw', text: '' });
    await expect(draft).toHaveAttribute('aria-invalid', 'true');
    expect(
        await draft.evaluate((el) =>
            el
                .getAttribute('aria-describedby')
                .split(' ')
                .every((id) => !!document.getElementById(id)),
        ),
    ).toBe(true);
    await header(page).focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    await expect.poll(() => input(page)).toEqual({ kind: 'value', value: '' });
    const cell = page.getByRole('combobox', { name: 'Row choice — Row a /?#', exact: true });
    const cellDraft = page.getByRole('textbox', {
        name: 'Row choice — Row a /?# draft',
        exact: true,
    });
    const row = page.locator('aur-detail-grid tbody tr').filter({ has: cell });
    const cellNode = await cell.elementHandle();
    for (const theme of themes) {
        await cellDraft.focus();
        const before = await state(page),
            count = (await events(page)).edits;
        await page.getByRole('button', { name: theme, exact: true }).evaluate((el) => el.click());
        await expect(cellDraft).toBeFocused();
        expect(await state(page)).toEqual(before);
        expect((await events(page)).edits).toBe(count);
    }
    await row.getByRole('button', { name: 'Next choices', exact: true }).click();
    await expect
        .poll(async () => (await events(page)).page)
        .toMatchObject({
            collectionId: 'rows',
            key: 'a /?#',
            field: 'choice',
            direction: 'next',
            path: [
                { kind: 'property', name: 'rows' },
                { kind: 'row', key: 'a /?#' },
                { kind: 'property', name: 'choice' },
            ],
        });
    await page.getByRole('button', { name: 'Move down Row a /?#', exact: true }).click();
    expect(await cell.evaluate((el, old) => el === old, cellNode)).toBe(true);
    for (const theme of themes) {
        await page.getByRole('button', { name: theme, exact: true }).click();
        const before = (await events(page)).edits;
        await cell.selectOption({
            value: theme === 'alternative' || theme === 'vintage' ? '' : opaque,
        });
        await expect.poll(async () => (await events(page)).edits).toBe(before + 1);
        expect((await events(page)).last).toMatchObject({
            key: 'a /?#',
            field: 'choice',
            path: [
                { kind: 'property', name: 'rows' },
                { kind: 'row', key: 'a /?#' },
                { kind: 'property', name: 'choice' },
            ],
        });
    }
    expect((await state(page)).properties.rows.rows.map((row) => row.key)).toEqual(['b', 'a /?#']);
    expect((await events(page)).unexpected).toBe(0);
});
