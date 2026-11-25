import { test, expect } from '@playwright/test';
const snapshot = async (page) =>
    JSON.parse(await page.getByTestId('editor-snapshot').textContent());
const summary = (page) => page.getByRole('region', { name: 'Document feedback', exact: true });
const enumEvents = async (page) => JSON.parse(await page.getByTestId('enum-events').textContent());
const statusInput = async (page) => (await snapshot(page)).properties.choice.input;
async function correct(page) {
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Draft title');
    await page
        .getByRole('textbox', { name: 'Exact count', exact: true })
        .fill('18446744073709551615');
    await summary(page)
        .getByRole('button', { name: /local: amount/ })
        .first()
        .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Numbers', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await expect(page.getByRole('button', { name: 'Amount section', exact: true })).toHaveAttribute(
        'aria-expanded',
        'true',
    );
    const amount = page.getByRole('textbox', { name: 'Exact amount', exact: true });
    await expect(amount).toBeFocused();
    await expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(
        await amount.evaluate((el) =>
            el
                .getAttribute('aria-describedby')
                .split(' ')
                .every((id) => !!document.getElementById(id)),
        ),
    ).toBe(true);
    await amount.fill('12345678901234567890.123456789');
    await summary(page)
        .getByRole('button', { name: /local: details.*nested.*quantity/ })
        .first()
        .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Details', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await expect(page.getByRole('button', { name: 'First section', exact: true })).toHaveAttribute(
        'aria-expanded',
        'true',
    );
    const nested = page.getByRole('textbox', { name: 'Nested quantity — Row n', exact: true });
    await expect(nested).toBeFocused();
    await expect(nested).toHaveValue('bad');
    await nested.fill('1e-');
    await expect(page.getByTestId('editor-validity')).toHaveText('invalid');
    await nested.fill('9007199254740993');
    await expect(page.getByTestId('editor-validity')).toHaveText('pending');
}
test('lossless input distinguishes missing, null, empty text, boolean and invalid raw without coercion', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/default-theme/?scenario=editor');
    await expect
        .poll(async () => (await snapshot(page)).properties.optional.input)
        .toEqual({ kind: 'absent' });
    expect((await snapshot(page)).properties.nullable.input).toEqual({
        kind: 'value',
        value: null,
    });
    await page.getByRole('button', { name: 'Set null Optional text', exact: true }).click();
    await expect
        .poll(async () => (await snapshot(page)).properties.optional.input)
        .toEqual({
            kind: 'value',
            value: null,
        });
    await page.getByRole('button', { name: 'Set empty text Optional text', exact: true }).click();
    await expect
        .poll(async () => (await snapshot(page)).properties.optional.input)
        .toEqual({ kind: 'value', value: '' });
    const optional = page.getByRole('textbox', { name: 'Optional text', exact: true });
    await optional.fill('-');
    await expect
        .poll(async () => (await snapshot(page)).properties.optional.input)
        .toEqual({ kind: 'raw', text: '-' });
    await optional.fill('');
    await expect
        .poll(async () => (await snapshot(page)).properties.optional.input)
        .toEqual({ kind: 'raw', text: '' });
    await page.getByRole('button', { name: 'Unset Optional text', exact: true }).click();
    await expect
        .poll(async () => (await snapshot(page)).properties.optional.input)
        .toEqual({ kind: 'absent' });
    await page.getByRole('checkbox', { name: 'Enabled', exact: true }).uncheck();
    await expect
        .poll(async () => (await snapshot(page)).properties.flag.input)
        .toEqual({ kind: 'value', value: false });
    await expect(page.getByRole('textbox', { name: 'Read only', exact: true })).toHaveAttribute(
        'readonly',
        '',
    );
    await expect(page.getByRole('textbox', { name: 'Disabled', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('editor-message')).toHaveText('blocked');
    await expect(page.getByTestId('editor-save')).toHaveText('idle');
    expect((await snapshot(page)).properties.amount.input.value).toBe('1e-');
    expect(errors).toEqual([]);
});
test('hidden errors reveal keyed nested cells, exact edits survive themes, and save/discard reuse the session', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/default-theme/?scenario=editor');
    await correct(page);
    await page.getByRole('button', { name: 'Add row to First details', exact: true }).click();
    await page
        .getByRole('textbox', { name: 'First quantity — Row new-1', exact: true })
        .fill('18446744073709551615');
    await page.getByRole('button', { name: 'Move down Row a', exact: true }).click();
    await page.getByRole('button', { name: 'Remove Row new-1', exact: true }).click();
    await expect
        .poll(async () =>
            (await snapshot(page)).properties.details.properties.first.rows.map((row) => row.key),
        )
        .toEqual(['b', 'a']);
    await page.getByRole('button', { name: 'Second section', exact: true }).click();
    await page.getByRole('button', { name: 'Add row to Second details', exact: true }).click();
    await page.getByRole('button', { name: 'Remove Row new-2', exact: true }).click();
    await expect(
        page.getByRole('textbox', { name: 'Second quantity — Row new-2', exact: true }),
    ).toHaveCount(0);
    const before = await snapshot(page);
    for (const theme of [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'grid-frame',
    ]) {
        await page.getByRole('button', { name: theme, exact: true }).click();
        expect(await snapshot(page)).toEqual(before);
        await expect(
            page.getByRole('textbox', { name: 'Nested quantity — Row n', exact: true }),
        ).toHaveValue('9007199254740993');
    }
    await page.getByRole('tab', { name: 'Header', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('editor-save')).toHaveText('saving');
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Reject conflict', exact: true }).click();
    await expect(page.getByTestId('editor-save')).toHaveText('idle');
    expect(await snapshot(page)).toEqual(before);
    await expect(summary(page)).toContainText('server: Document');
    await expect(summary(page)).toContainText('Synthetic row rejection');
    await summary(page)
        .getByRole('button', { name: /server: details.*nested \/ n —/ })
        .first()
        .click();
    const nested = page.getByRole('textbox', { name: 'Nested quantity — Row n', exact: true });
    await expect(nested).toBeFocused();
    const described = await nested.getAttribute('aria-describedby');
    expect(described).toContain('aur-row-message-');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Committed', exact: true }).click();
    await expect(page.getByTestId('editor-save')).toHaveText('reconciling');
    await expect(nested).toBeDisabled();
    await page.getByRole('button', { name: 'Accept authoritative', exact: true }).click();
    await expect(page.getByTestId('editor-dirty')).toHaveText('false');
    await expect(page.getByTestId('editor-save')).toHaveText('idle');
    const accepted = await snapshot(page);
    expect(accepted.properties.details.properties.first.rows.map((row) => row.key)).toEqual([
        'b',
        'a',
    ]);
    expect(accepted.properties.count.input.value).toBe('18446744073709551615');
    expect(accepted.properties.amount.input.value).toBe('12.3400');
    await page.getByRole('tab', { name: 'Header', exact: true }).click();
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Later draft');
    await expect
        .poll(async () => (await snapshot(page)).properties.title.input)
        .toEqual({ kind: 'raw', text: 'Later draft' });
    const draft = await snapshot(page);
    const discard = page.getByRole('button', { name: 'Discard', exact: true });
    await discard.click();
    await page.getByRole('button', { name: 'Cancel discard', exact: true }).click();
    expect(await snapshot(page)).toEqual(draft);
    await expect(discard).toBeFocused();
    await discard.click();
    await page.getByRole('button', { name: 'Confirm discard', exact: true }).click();
    await expect(page.getByTestId('editor-dirty')).toHaveText('false');
    expect(await snapshot(page)).toEqual(accepted);
    expect(errors).toEqual([]);
});

test('lossless themed ENUM keeps exact states, feedback and keyed intents through form/grid selection', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/default-theme/?scenario=editor');
    const select = page.getByRole('combobox', { name: 'Status', exact: true });
    const draft = page.getByRole('textbox', { name: 'Status draft', exact: true });
    await expect(select).toHaveValue('OPEN');
    const defaultHeight = await select.evaluate((el) => el.getBoundingClientRect().height);
    expect(await enumEvents(page)).toEqual({ fields: 0, cells: 0, legacy: 0, last: null });
    for (const value of ['', 'Not set', ' spaced ', 'e\u0301', 'é']) {
        const before = (await enumEvents(page)).fields;
        await select.selectOption({ value });
        await expect.poll(() => statusInput(page)).toEqual({ kind: 'value', value });
        expect((await enumEvents(page)).fields).toBe(before + 1);
        expect((await enumEvents(page)).legacy).toBe(0);
    }
    for (const [button, input, placeholder] of [
        ['Unset Status', { kind: 'absent' }, 'Absent'],
        ['Set null Status', { kind: 'value', value: null }, 'Null'],
        ['Set empty text Status', { kind: 'value', value: '' }, '(empty string)'],
    ]) {
        await page.getByRole('button', { name: button, exact: true }).click();
        await expect.poll(() => statusInput(page)).toEqual(input);
        await expect(select.locator('option:checked')).toContainText(placeholder);
    }
    for (const [button, input, text] of [
        ['Use unknown ENUM', { kind: 'value', value: 'UNKNOWN' }, 'UNKNOWN'],
        ['Use raw ENUM', { kind: 'raw', text: 'invalid draft' }, 'invalid draft'],
        ['Use invalid ENUM type', { kind: 'value', value: false }, 'false'],
    ]) {
        await page.getByRole('button', { name: button, exact: true }).click();
        await expect(draft).toHaveValue(text);
        await expect(select).toHaveAttribute('aria-invalid', 'true');
        expect(
            await select.evaluate((el) =>
                el
                    .getAttribute('aria-describedby')
                    .split(' ')
                    .every((id) => !!document.getElementById(id)),
            ),
        ).toBe(true);
        const before = await snapshot(page),
            events = await enumEvents(page);
        for (const theme of ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast']) {
            await select.focus();
            const node = await select.elementHandle();
            // Activate without moving focus away from the field under test.
            await page
                .getByRole('button', { name: theme, exact: true })
                .evaluate((el) => el.click());
            await expect(select).toBeFocused();
            expect(await select.evaluate((el, old) => el === old, node)).toBe(true);
            await expect(draft).toHaveValue(text);
            expect(await snapshot(page)).toEqual(before);
            expect(await enumEvents(page)).toEqual(events);
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            ).toBe(true);
            if (theme === 'high-contrast') {
                expect(
                    await select.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
                ).toBeGreaterThan(16);
                expect(
                    await select.evaluate((el) => el.getBoundingClientRect().height),
                ).toBeGreaterThan(defaultHeight);
            }
        }
        expect(await statusInput(page)).toEqual(input);
    }
    await draft.fill('');
    await expect.poll(() => statusInput(page)).toEqual({ kind: 'raw', text: '' });
    await expect(select.locator('option:checked')).toContainText('Draft');
    await draft.fill('OPEN');
    await expect.poll(() => statusInput(page)).toEqual({ kind: 'raw', text: 'OPEN' });
    // A valid raw draft is still raw until explicitly selected.
    await expect(select.locator('option:checked')).toContainText('Draft');
    await select.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect.poll(() => statusInput(page)).toEqual({ kind: 'value', value: '' });
    for (const theme of ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast']) {
        await page.getByRole('button', { name: theme, exact: true }).click();
        const before = (await enumEvents(page)).fields;
        const value = theme === 'alternative' || theme === 'vintage' ? 'é' : 'e\u0301';
        await select.selectOption({ value });
        await expect.poll(() => statusInput(page)).toEqual({ kind: 'value', value });
        expect((await enumEvents(page)).fields).toBe(before + 1);
    }
    const fixed = page.getByRole('combobox', { name: 'Fixed status', exact: true });
    const disabled = page.getByRole('combobox', { name: 'Disabled status', exact: true });
    await expect(fixed).toBeDisabled();
    await expect(disabled).toBeDisabled();
    const blocked = await snapshot(page),
        blockedEvents = await enumEvents(page);
    for (const control of [fixed, disabled]) {
        await control.evaluate((el) => {
            el.selectedIndex = 2;
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }
    expect(await snapshot(page)).toEqual(blocked);
    expect(await enumEvents(page)).toEqual(blockedEvents);
    await page.getByRole('tab', { name: 'Details', exact: true }).click();
    await page.getByRole('button', { name: 'First section', exact: true }).click();
    const cell = page.getByRole('combobox', { name: 'Row status — Row a', exact: true });
    const cellDraft = page.getByRole('textbox', { name: 'Row status — Row a draft', exact: true });
    await expect(cellDraft).toHaveValue('false');
    for (const theme of ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast']) {
        await cellDraft.focus();
        const before = await snapshot(page),
            events = await enumEvents(page);
        await page.getByRole('button', { name: theme, exact: true }).evaluate((el) => el.click());
        await expect(cellDraft).toBeFocused();
        expect(await snapshot(page)).toEqual(before);
        expect(await enumEvents(page)).toEqual(events);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    }
    const beforeCell = (await enumEvents(page)).cells;
    await cell.selectOption({ value: ' spaced ' });
    await expect.poll(async () => (await enumEvents(page)).cells).toBe(beforeCell + 1);
    const events = await enumEvents(page);
    expect(events.cells).toBe(beforeCell + 1);
    expect(events.legacy).toBe(0);
    expect(events.last).toMatchObject({
        collectionId: 'first',
        key: 'a',
        field: 'choice',
        path: [
            { kind: 'property', name: 'details' },
            { kind: 'property', name: 'first' },
            { kind: 'row', key: 'a' },
            { kind: 'property', name: 'choice' },
        ],
        input: { kind: 'value', value: ' spaced ' },
    });
    await page.getByRole('button', { name: 'Move down Row a', exact: true }).click();
    await expect(cell).toHaveValue(' spaced ');
    for (const theme of ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast']) {
        await page.getByRole('button', { name: theme, exact: true }).click();
        const before = (await enumEvents(page)).cells;
        await cell.selectOption({
            value: theme === 'alternative' || theme === 'vintage' ? '' : 'OPEN',
        });
        await expect.poll(async () => (await enumEvents(page)).cells).toBe(before + 1);
        expect((await enumEvents(page)).last.key).toBe('a');
        expect((await enumEvents(page)).legacy).toBe(0);
    }
    expect(
        (await snapshot(page)).properties.details.properties.first.rows.map((row) => row.key),
    ).toEqual(['b', 'a']);
    expect(errors).toEqual([]);
});
