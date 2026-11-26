import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const themes = ['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast'];
const editor = (page) => page.getByTestId('integrated-editor');
const list = (page) => page.getByTestId('integrated-list');
const snapshot = async (page) =>
    JSON.parse(await editor(page).getByTestId('editor-snapshot').textContent());
const counts = async (page) =>
    JSON.parse(await editor(page).getByTestId('integration-editor-events').textContent());
const listEvents = async (page) =>
    JSON.parse(await list(page).getByTestId('list-events').textContent());
const listState = async (page) =>
    JSON.parse(await list(page).getByTestId('list-state').textContent());
const navigation = async (page) =>
    JSON.parse(await page.getByTestId('integration-navigation').textContent());
const summary = (page) =>
    editor(page).getByRole('region', { name: 'Document feedback', exact: true });
const button = (scope, name) => scope.getByRole('button', { name, exact: true });
const title = (page) => editor(page).getByRole('textbox', { name: 'Title', exact: true });
const extension = (page) => editor(page).getByLabel('Extension draft', { exact: true });
async function tab(page, name) {
    await editor(page).getByRole('tab', { name, exact: true }).click();
}
async function fillField(page, control, text) {
    const before = (await counts(page)).fields;
    await control.fill(text);
    await expect.poll(async () => (await counts(page)).fields).toBe(before + 1);
}
async function correct(page) {
    await fillField(page, title(page), 'Working title');
    await summary(page)
        .getByRole('button', { name: /local: amount/ })
        .focus();
    await page.keyboard.press('Enter');
    const amount = editor(page).getByRole('textbox', { name: 'Exact amount', exact: true });
    await expect(amount).toBeFocused();
    await fillField(page, amount, '12345678901234567890.123456789');
    await summary(page)
        .getByRole('button', { name: /local: details.*nested.*quantity/ })
        .focus();
    await page.keyboard.press('Enter');
    const nested = editor(page).getByRole('textbox', {
        name: 'Nested quantity — Row n',
        exact: true,
    });
    await expect(nested).toBeFocused();
    const before = (await counts(page)).cells;
    await nested.fill('9007199254740993');
    await expect.poll(async () => (await counts(page)).cells).toBe(before + 1);
    await expect(editor(page).getByTestId('editor-validity')).toHaveText('pending');
}
async function menu(page, name) {
    const toggle = button(page, 'More menus');
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
    await button(page, name).click();
}
async function capture(page, info, name) {
    const dir = '/artifacts/testbed/integrated/' + info.project.name;
    await mkdir(dir, { recursive: true });
    await page.screenshot({
        path: dir + '/' + name + '.png',
        fullPage: true,
        animations: 'disabled',
    });
}
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
    const failures = [];
    errors.set(page, failures);
    page.on('pageerror', (e) => failures.push(e.message));
    page.on('console', (e) => {
        if (e.type() === 'error') failures.push(e.text());
    });
    page.on('request', (r) => {
        if (['fetch', 'xhr'].includes(r.resourceType())) failures.push(r.url());
    });
    page.on('requestfailed', (r) => failures.push(r.url()));
    page.on('response', (r) => {
        if (r.status() >= 400) failures.push(r.url());
    });
    await page.goto('/default-theme/?scenario=integrated');
    await expect(editor(page).getByRole('tab')).toHaveText([
        'General information',
        'Detail information',
        'Additional content',
    ]);
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));
test('integrated editor: exact states, simultaneous feedback, keyboard reveal, mixed slots and theme lifetime', async ({
    page,
}, info) => {
    const initial = await snapshot(page);
    expect(initial.properties.optional.input).toEqual({ kind: 'absent' });
    expect(initial.properties.nullable.input).toEqual({ kind: 'value', value: null });
    expect(initial.properties.title.input).toEqual({ kind: 'value', value: '' });
    expect(initial.properties.count.input.value).toBe('18446744073709551615');
    expect(initial.properties.amount.input.value).toBe('1e-');
    await expect(
        summary(page).getByRole('region', { name: 'Errors', exact: true }).getByRole('listitem'),
    ).toHaveCount(3);
    await expect(
        summary(page).getByRole('region', { name: 'Deferred checks', exact: true }),
    ).toContainText('Authoritative check pending.');
    await expect(
        summary(page)
            .getByRole('region', { name: 'Errors', exact: true })
            .getByRole('listitem')
            .first(),
    ).toContainText('local: amount');
    await button(summary(page), 'Focus first error').focus();
    await page.keyboard.press('Enter');
    await expect(
        editor(page).getByRole('textbox', { name: 'Exact amount', exact: true }),
    ).toBeFocused();
    await expect.poll(async () => (await counts(page)).focus).toEqual([true]);
    expect(await snapshot(page)).toEqual(initial);
    for (const [name, input] of [
        ['Set null Optional text', { kind: 'value', value: null }],
        ['Set empty text Optional text', { kind: 'value', value: '' }],
        ['Unset Optional text', { kind: 'absent' }],
    ]) {
        const before = (await counts(page)).fields;
        await button(editor(page), name).click();
        await expect
            .poll(async () => (await snapshot(page)).properties.optional.input)
            .toEqual(input);
        expect((await counts(page)).fields).toBe(before + 1);
    }
    await fillField(
        page,
        editor(page).getByRole('textbox', { name: 'Optional text', exact: true }),
        'raw draft',
    );
    await expect
        .poll(async () => (await snapshot(page)).properties.optional.input)
        .toEqual({ kind: 'raw', text: 'raw draft' });
    await fillField(
        page,
        editor(page).getByRole('textbox', { name: 'Optional text', exact: true }),
        '',
    );
    await expect
        .poll(async () => (await snapshot(page)).properties.optional.input)
        .toEqual({ kind: 'raw', text: '' });
    const enumBefore = (await counts(page)).fields;
    await editor(page)
        .getByRole('combobox', { name: 'Status', exact: true })
        .selectOption({ value: 'e\u0301' });
    await expect
        .poll(async () => (await snapshot(page)).properties.choice.input)
        .toEqual({ kind: 'value', value: 'e\u0301' });
    expect((await counts(page)).fields).toBe(enumBefore + 1);
    await expect(
        editor(page).getByRole('textbox', { name: 'Read only', exact: true }),
    ).toHaveJSProperty('readOnly', true);
    await expect(
        editor(page).getByRole('textbox', { name: 'Disabled', exact: true }),
    ).toBeDisabled();
    await capture(page, info, 'general-default');
    await correct(page);
    await capture(page, info, 'details-default');
    const detailNode = await editor(page)
        .getByRole('textbox', { name: 'First quantity — Row a', exact: true })
        .elementHandle();
    await tab(page, 'Additional content');
    await expect(
        editor(page).getByRole('textbox', { name: 'Server check', exact: true }),
    ).toBeVisible();
    const mixed = editor(page).getByRole('group', {
        name: 'Mixed application content',
        exact: true,
    });
    expect(
        await mixed.evaluate((el) =>
            Array.from(el.children)
                .map((node) => node.tagName)
                .filter((tag) => tag.startsWith('AUR-')),
        ),
    ).toEqual(['AUR-FORM-FIELD', 'AUR-FORM-SLOT']);
    await extension(page).fill('Retained extension draft');
    await expect.poll(async () => (await counts(page)).extension).toBe(1);
    const node = await extension(page).elementHandle(),
        component = await editor(page).locator('qa-acceptance-extension').elementHandle();
    await button(editor(page), 'Inspect extension').focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await counts(page)).actions).toEqual(['inspect-extension']);
    await expect(button(editor(page), 'Unavailable contextual action')).toBeDisabled();
    await button(editor(page), 'Unavailable contextual action').dispatchEvent('click');
    expect((await counts(page)).actions).toEqual(['inspect-extension']);
    await button(editor(page), 'Additional section').click();
    await expect(extension(page)).toBeHidden();
    await button(editor(page), 'Additional section').click();
    await expect(extension(page)).toHaveValue('Retained extension draft');
    await editor(page).getByRole('tab', { name: 'Additional content', exact: true }).focus();
    await page.keyboard.press('Home');
    await expect(
        editor(page).getByRole('tab', { name: 'General information', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(
        editor(page).getByRole('tab', { name: 'Detail information', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('End');
    await expect(
        editor(page).getByRole('tab', { name: 'Additional content', exact: true }),
    ).toBeFocused();
    const state = await snapshot(page),
        before = await counts(page);
    for (const theme of themes) {
        await extension(page).focus();
        await button(page, theme).evaluate((el) => el.click());
        await expect(page.locator('aur-theme-shell')).toHaveClass('theme-' + theme);
        await expect(extension(page)).toBeFocused();
        await button(editor(page), 'Refresh editor contexts').evaluate((el) => el.click());
        await expect(extension(page)).toBeFocused();
        expect(await extension(page).evaluate((el, old) => el === old, node)).toBe(true);
        expect(
            await editor(page)
                .locator('qa-acceptance-extension')
                .evaluate((el, old) => el === old, component),
        ).toBe(true);
        expect(await detailNode.evaluate((el) => el.isConnected)).toBe(true);
        await expect(extension(page)).toHaveValue('Retained extension draft');
        expect(await snapshot(page)).toEqual(state);
        expect(await counts(page)).toEqual(before);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await capture(page, info, 'additional-' + theme);
    }
    await button(editor(page), 'Toggle editor read-only').click();
    await expect(extension(page)).toHaveJSProperty('readOnly', true);
    await expect(editor(page).getByLabel('Title', { exact: true })).toHaveJSProperty(
        'readOnly',
        true,
    );
    await button(editor(page), 'Toggle extension disabled').click();
    await expect(extension(page)).toBeDisabled();
    await extension(page).evaluate((el) => {
        el.value = 'Blocked';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.value = 'Retained extension draft';
    });
    expect((await counts(page)).extension).toBe(1);
    expect(await snapshot(page)).toEqual(state);
    await button(editor(page), 'Toggle extension disabled').click();
    await button(editor(page), 'Toggle editor read-only').click();
    const focusCount = (await counts(page)).focus.length;
    await button(editor(page), 'Reveal unknown path').click();
    await expect.poll(async () => (await counts(page)).focus.length).toBe(focusCount + 1);
    await expect.poll(async () => (await counts(page)).focus.at(-1)).toBe(false);
    await expect(button(editor(page), 'Reveal unknown path')).toBeFocused();
    expect((await counts(page)).legacy).toBe(0);
    expect((await counts(page)).lifetime).toBe('1/0');
});
test('integrated shell/list: typed and legacy menus preserve a dirty editor and controlled page/query state', async ({
    page,
}, info) => {
    await fillField(page, title(page), 'Dirty across list view');
    const document = await snapshot(page);
    await menu(page, 'Open list');
    await expect(list(page)).toBeVisible();
    await expect(editor(page)).toBeHidden();
    await expect
        .poll(async () => (await navigation(page)).events)
        .toEqual([{ source: 'typed', target: 'list' }]);
    const grid = list(page).locator('aur-list-grid').first(),
        checks = grid.getByRole('checkbox');
    await button(list(page), 'Toggle selection acceptance').click();
    await checks.nth(1).focus();
    await page.keyboard.press('Space');
    await expect(checks.nth(1)).toBeChecked();
    await expect
        .poll(async () => (await listEvents(page)).selection)
        .toEqual([{ key: 'b', selected: true }]);
    await button(grid, 'Select Repeated (row 1)').click();
    await expect.poll(async () => (await listEvents(page)).single).toEqual(['a /?#']);
    await button(grid, 'Next page').click();
    await expect
        .poll(async () => (await listEvents(page)).pages)
        .toEqual([{ direction: 'next', offset: 2, pageSize: 2 }]);
    expect((await listState(page)).mode).toBe('a');
    await button(list(page), 'Supply page B').click();
    await expect.poll(async () => (await listState(page)).mode).toBe('b');
    await expect(checks.first()).toBeChecked();
    await expect(grid.getByRole('status')).toContainText('2 outside this page');
    await expect(button(grid, 'Next page')).toBeDisabled();
    const filter = grid.getByRole('textbox', { name: /^Filter text/ }),
        sort = grid.getByRole('combobox', { name: 'Primary sort', exact: true });
    const exact = '  null 9007199254740993 1e- e\u0301  ';
    await filter.fill(exact);
    await sort.selectOption({ value: 'opaque /?#' });
    await expect
        .poll(
            async () =>
                (await listState(page)).query.inputs.find((input) => input.id === 'sort').value,
        )
        .toBe('opaque /?#');
    expect((await listEvents(page)).applies).toEqual([]);
    await button(grid, 'Apply query').focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await listEvents(page)).applies.length).toBe(1);
    expect((await listEvents(page)).applies[0].find((input) => input.id === 'filter').value).toBe(
        exact,
    );
    const queryState = await listState(page),
        filterNode = await filter.elementHandle();
    let queryEvents = await listEvents(page);
    for (const theme of themes) {
        await filter.focus();
        await button(page, theme).evaluate((el) => el.click());
        await expect(page.locator('aur-theme-shell')).toHaveClass('theme-' + theme);
        await expect(filter).toBeFocused();
        expect(await filter.evaluate((el, old) => el === old, filterNode)).toBe(true);
        expect(await listState(page)).toEqual(queryState);
        expect(await listEvents(page)).toEqual(queryEvents);
        expect(await snapshot(page)).toEqual(document);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await capture(page, info, 'list-' + theme);
        const start = await listEvents(page);
        await button(grid, 'Previous page').click();
        await expect
            .poll(async () => (await listEvents(page)).pages.length)
            .toBe(start.pages.length + 1);
        expect((await listEvents(page)).pages.at(-1).offset).toBe(0);
        await checks.first().click();
        await expect(checks.first()).not.toBeChecked();
        await checks.first().click();
        await expect(checks.first()).toBeChecked();
        await expect
            .poll(async () => (await listEvents(page)).selection.length)
            .toBe(start.selection.length + 2);
        expect((await listEvents(page)).selection.slice(-2)).toEqual([
            { key: 'b', selected: false },
            { key: 'b', selected: true },
        ]);
        await button(grid, 'Apply query').click();
        await expect
            .poll(async () => (await listEvents(page)).applies.length)
            .toBe(start.applies.length + 1);
        expect(await listState(page)).toEqual(queryState);
        queryEvents = await listEvents(page);
    }
    await button(list(page), 'Empty unknown total').click();
    await expect(button(grid, 'Next page')).toBeEnabled();
    await button(grid, 'Next page').click();
    await expect.poll(async () => (await listEvents(page)).pages.at(-1).offset).toBe(6);
    await button(list(page), 'Empty zero total').click();
    await expect(button(grid, 'Next page')).toBeDisabled();
    await expect(button(grid, 'Previous page')).toBeDisabled();
    await button(page, 'Use legacy menus').click();
    await expect(button(page, 'Editor legacy')).toBeVisible();
    await expect(button(page, 'Open editor')).toHaveCount(0);
    await button(page, 'Editor legacy').focus();
    await page.keyboard.press('Enter');
    await expect(editor(page)).toBeVisible();
    await expect(title(page)).toHaveValue('Dirty across list view');
    expect(await snapshot(page)).toEqual(document);
    await expect(editor(page).getByTestId('editor-dirty')).toHaveText('true');
    await expect.poll(async () => (await navigation(page)).events.length).toBe(2);
    await button(page, 'Use typed menus').click();
    await expect(button(page, 'Editor legacy')).toHaveCount(0);
    await menu(page, 'Open editor');
    await expect.poll(async () => (await navigation(page)).events.length).toBe(3);
    await expect(button(page, 'Unavailable view')).toBeDisabled();
    await button(page, 'Unavailable view').dispatchEvent('click');
    expect((await navigation(page)).events).toEqual([
        { source: 'typed', target: 'list' },
        { source: 'legacy', target: 'editor' },
        { source: 'typed', target: 'editor' },
    ]);
    expect(await snapshot(page)).toEqual(document);
});
for (const theme of themes)
    test(
        'integrated document ' +
            theme +
            ': two keyed collections, save/rejections/conflict/reconciliation and discard focus',
        async ({ page }, info) => {
            await button(page, theme).click();
            await expect(page.locator('aur-theme-shell')).toHaveClass('theme-' + theme);
            await button(summary(page), 'Focus first error').focus();
            await page.keyboard.press('Enter');
            await expect(
                editor(page).getByRole('textbox', { name: 'Exact amount', exact: true }),
            ).toBeFocused();
            const beforeEnum = (await counts(page)).fields;
            await editor(page)
                .getByRole('combobox', { name: 'Status', exact: true })
                .selectOption({ value: ' spaced ' });
            await expect.poll(async () => (await counts(page)).fields).toBe(beforeEnum + 1);
            await expect
                .poll(async () => (await snapshot(page)).properties.choice.input)
                .toEqual({ kind: 'value', value: ' spaced ' });
            await correct(page);
            const first = editor(page).getByRole('textbox', {
                name: 'First quantity — Row a',
                exact: true,
            });
            const rowNode = await first.elementHandle();
            const secondToggle = button(editor(page), 'Second section');
            await secondToggle.click();
            const second = editor(page).getByRole('textbox', {
                name: 'Second quantity — Row x',
                exact: true,
            });
            const beforeCells = (await counts(page)).cells;
            await second.fill('18446744073709551614');
            await expect.poll(async () => (await counts(page)).cells).toBe(beforeCells + 1);
            await button(editor(page), 'Add row to First details').click();
            await expect.poll(async () => (await counts(page)).structures).toBe(1);
            await expect(
                editor(page).getByRole('textbox', {
                    name: 'First quantity — Row new-1',
                    exact: true,
                }),
            ).toBeVisible();
            await button(editor(page), 'Move down Row a').click();
            await expect.poll(async () => (await counts(page)).structures).toBe(2);
            expect(await first.evaluate((el, old) => el === old, rowNode)).toBe(true);
            await button(editor(page), 'Remove Row new-1').click();
            await expect.poll(async () => (await counts(page)).structures).toBe(3);
            const draft = await snapshot(page);
            expect(draft.properties.details.properties.first.rows.map((row) => row.key)).toEqual([
                'b',
                'a',
            ]);
            expect(
                draft.properties.details.properties.second.rows[0].value.properties.quantity.input,
            ).toEqual({ kind: 'raw', text: '18446744073709551614' });
            const save = button(editor(page), 'Save');
            await save.click();
            await expect(editor(page).getByTestId('editor-save')).toHaveText('saving');
            await expect(editor(page).getByLabel('Title', { exact: true })).toBeDisabled();
            await expect(extension(page)).toHaveJSProperty('readOnly', true);
            await expect(button(editor(page), 'Add row to First details')).toBeDisabled();
            expect(await snapshot(page)).toEqual(draft);
            await button(editor(page), 'Reject validation').click();
            await expect(editor(page).getByTestId('editor-save')).toHaveText('idle');
            await expect(summary(page)).toContainText('Synthetic validation rejection');
            await expect(summary(page)).toContainText('Synthetic header rejection');
            await expect(summary(page)).toContainText('Synthetic row rejection');
            expect(await snapshot(page)).toEqual(draft);
            await expect(
                summary(page).getByRole('region', { name: 'Deferred checks', exact: true }),
            ).toContainText('Authoritative check pending');
            const focusCount = (await counts(page)).focus.length;
            await summary(page)
                .getByRole('button', { name: /server: details.*nested \/ n —/ })
                .click();
            await expect(
                editor(page).getByRole('textbox', { name: 'Nested quantity — Row n', exact: true }),
            ).toBeFocused();
            await expect.poll(async () => (await counts(page)).focus.length).toBe(focusCount + 1);
            await expect.poll(async () => (await counts(page)).focus.at(-1)).toBe(true);
            await save.click();
            await expect(editor(page).getByTestId('editor-save')).toHaveText('saving');
            await button(editor(page), 'Reject conflict').click();
            await expect(summary(page)).toContainText('Synthetic version conflict');
            expect(await snapshot(page)).toEqual(draft);
            await save.click();
            await expect(editor(page).getByTestId('editor-save')).toHaveText('saving');
            await button(editor(page), 'Committed').click();
            await expect(editor(page).getByTestId('editor-save')).toHaveText('reconciling');
            await expect(editor(page).getByLabel('Title', { exact: true })).toBeDisabled();
            await button(editor(page), 'Accept authoritative').click();
            await expect(editor(page).getByTestId('editor-save')).toHaveText('idle');
            await expect(editor(page).getByTestId('editor-dirty')).toHaveText('false');
            const accepted = await snapshot(page);
            expect(accepted.properties.count.input.value).toBe('18446744073709551615');
            expect(accepted.properties.amount.input.value).toBe('12.3400');
            expect(accepted.properties.title.input.value).toBe('Authoritative title');
            expect(accepted.properties.details.properties.first.rows.map((row) => row.key)).toEqual(
                ['b', 'a'],
            );
            await expect(
                summary(page).getByRole('region', { name: 'Deferred checks', exact: true }),
            ).toContainText('Authoritative check pending');
            await tab(page, 'General information');
            await fillField(page, title(page), 'Later dirty draft');
            const later = await snapshot(page),
                discard = button(editor(page), 'Discard');
            await discard.focus();
            await page.keyboard.press('Enter');
            const dialog = editor(page).getByRole('dialog', {
                name: 'Discard changes',
                exact: true,
            });
            await expect(button(dialog, 'Cancel discard')).toBeFocused();
            await page.keyboard.press('Escape');
            await expect(dialog).not.toBeVisible();
            await expect(discard).toBeFocused();
            expect(await snapshot(page)).toEqual(later);
            await page.keyboard.press('Enter');
            await expect(button(dialog, 'Cancel discard')).toBeFocused();
            await button(dialog, 'Confirm discard').focus();
            await page.keyboard.press('Space');
            await expect(dialog).not.toBeVisible();
            await expect(discard).toBeFocused();
            await expect(editor(page).getByTestId('editor-dirty')).toHaveText('false');
            expect(await snapshot(page)).toEqual(accepted);
            expect((await counts(page)).legacy).toBe(0);
            expect((await counts(page)).structures).toBe(3);
            await capture(page, info, 'accepted-after-discard-' + theme);
        },
    );
