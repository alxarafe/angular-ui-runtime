import { test, expect } from '@playwright/test';
const host = (page) => page.locator('aur-list-grid').first();
const state = async (page) => JSON.parse(await page.getByTestId('list-state').textContent());
const events = async (page) => JSON.parse(await page.getByTestId('list-events').textContent());
const filter = (page) => host(page).getByRole('textbox', { name: /^Filter text/ });
const button = (page, name) => page.getByRole('button', { name, exact: true });
const faults = new WeakMap();
test.beforeEach(async ({ page }) => {
    const errors = [];
    faults.set(page, errors);
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (e) => {
        if (e.type() === 'error') errors.push(e.text());
    });
    page.on('request', (r) => {
        if (['fetch', 'xhr'].includes(r.resourceType())) errors.push(r.url());
    });
    await page.goto('/default-theme/?scenario=list-ports');
});
test.afterEach(async ({ page }) => expect(faults.get(page)).toEqual([]));
test('single and multiple selection remain independent, controlled and keyed across page changes', async ({
    page,
}) => {
    const check = host(page).getByRole('checkbox');
    await expect(check).toHaveCount(2);
    await expect(check.nth(0)).toBeChecked();
    await expect(check.nth(1)).not.toBeChecked();
    await expect(check.nth(0)).toHaveAccessibleName('Include Repeated (row 1)');
    await expect(check.nth(1)).toHaveAccessibleName('Include Repeated (row 2)');
    await check.nth(1).click();
    await expect(check.nth(1)).not.toBeChecked();
    expect((await state(page)).selected).toEqual(['outside', 'a /?#']);
    await expect
        .poll(async () => (await events(page)).selection)
        .toEqual([{ key: 'b', selected: true }]);
    await button(page, 'Toggle selection acceptance').click();
    await check.nth(1).focus();
    await page.keyboard.press('Space');
    await expect(check.nth(1)).toBeChecked();
    await check.nth(0).click();
    await expect(check.nth(0)).not.toBeChecked();
    await expect
        .poll(async () => (await events(page)).selection.at(-1))
        .toEqual({ key: 'a /?#', selected: false });
    await check.nth(0).click();
    await expect(check.nth(0)).toBeChecked();
    const b = await check.nth(1).elementHandle();
    const count = (await events(page)).selection.length;
    await host(page).getByRole('button', { name: 'Select Repeated (row 2)', exact: true }).click();
    await expect.poll(async () => (await events(page)).single).toEqual(['b']);
    expect((await events(page)).selection.length).toBe(count);
    await button(page, 'Supply page B').click();
    await expect.poll(async () => (await state(page)).mode).toBe('b');
    expect(await check.nth(0).evaluate((el, old) => el === old, b)).toBe(true);
    await expect(check.nth(0)).toBeChecked();
    expect((await state(page)).selected).toEqual(['outside', 'b', 'a /?#']);
    await expect(host(page).getByRole('status')).toContainText('2 outside this page');
    expect((await events(page)).selection.length).toBe(count);
    await button(page, 'Supply page A').click();
    await expect.poll(async () => (await state(page)).mode).toBe('a');
    await expect(check.nth(0)).toBeChecked();
    await expect(check.nth(1)).toBeChecked();
    await button(page, 'Select Legacy row').click();
    await expect.poll(async () => (await state(page)).legacy).toBe('legacy-key');
    await expect.poll(async () => (await events(page)).single).toEqual(['b']);
});
test('paging is explicit and availability-aware with first/last boundaries, empty pages and unknown totals', async ({
    page,
}) => {
    const previous = host(page).getByRole('button', { name: 'Previous page', exact: true }),
        next = host(page).getByRole('button', { name: 'Next page', exact: true });
    await expect(previous).toBeDisabled();
    await next.click();
    await expect
        .poll(async () => (await events(page)).pages)
        .toEqual([{ direction: 'next', offset: 2, pageSize: 2 }]);
    expect((await state(page)).mode).toBe('a');
    await button(page, 'Supply page B').click();
    await expect.poll(async () => (await state(page)).mode).toBe('b');
    await expect(next).toBeDisabled();
    await previous.click();
    await expect
        .poll(async () => (await events(page)).pages.at(-1))
        .toEqual({
            direction: 'previous',
            offset: 0,
            pageSize: 2,
        });
    expect((await state(page)).mode).toBe('b');
    await button(page, 'Empty zero total').click();
    await expect(previous).toBeDisabled();
    await expect(next).toBeDisabled();
    await expect(host(page)).toContainText('No rows.');
    await expect(host(page)).toContainText('Total 0');
    await button(page, 'Empty unknown total').click();
    await expect(previous).toBeEnabled();
    await expect(next).toBeEnabled();
    await expect(host(page)).toContainText('Total not supplied');
    await next.focus();
    await page.keyboard.press('Enter');
    await expect
        .poll(async () => (await events(page)).pages.at(-1))
        .toEqual({
            direction: 'next',
            offset: 6,
            pageSize: 2,
        });
    const count = (await events(page)).pages.length;
    await button(page, 'Toggle next availability').click();
    await expect(next).toBeDisabled();
    await next.dispatchEvent('click');
    expect((await events(page)).pages.length).toBe(count);
    expect((await events(page)).selection).toEqual([]);
});
test('query presentation preserves exact strings and opaque options; apply is explicit and locked states suppress synthetic events', async ({
    page,
}) => {
    const search = host(page).getByRole('textbox', { name: 'Search term', exact: true }),
        sort = host(page).getByRole('combobox', { name: 'Primary sort', exact: true });
    await expect(sort.locator('option:checked')).toHaveText('Default order');
    await expect(
        host(page).getByRole('button', { name: /Set null|Unset|Previous choices|Next choices/ }),
    ).toHaveCount(0);
    const exact = '  null false 9007199254740993 1e- e\u0301 /?#  ';
    await filter(page).fill(exact);
    await search.fill('  search /?#  ');
    await sort.selectOption({ value: 'opaque /?#' });
    await host(page)
        .getByRole('combobox', { name: 'Application predicate', exact: true })
        .selectOption({ value: 'second' });
    expect((await events(page)).applies).toEqual([]);
    expect((await state(page)).mode).toBe('a');
    await expect
        .poll(async () => (await state(page)).query.inputs.find((x) => x.id === 'predicate').value)
        .toBe('second');
    expect((await state(page)).query.inputs.find((x) => x.id === 'filter').value).toBe(exact);
    await expect(filter(page)).toHaveValue(exact);
    await expect(host(page)).toContainText('Application supplied filter guidance.');
    expect(
        await filter(page).evaluate((el) =>
            el
                .closest('aur-form-field')
                .getAttribute('aria-describedby')
                .split(' ')
                .every((id) => !!document.getElementById(id)),
        ),
    ).toBe(true);
    await host(page).getByRole('button', { name: 'Apply query', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await events(page)).applies.length).toBe(1);
    expect((await events(page)).applies[0].find((x) => x.id === 'filter').value).toBe(exact);
    expect((await events(page)).applies[0].find((x) => x.id === 'sort').value).toBe('opaque /?#');
    await filter(page).fill('');
    await expect
        .poll(async () => (await state(page)).query.inputs.find((x) => x.id === 'filter').value)
        .toBe('');
    await host(page).getByRole('button', { name: 'Apply query', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect.poll(async () => (await events(page)).applies.length).toBe(2);
    expect((await events(page)).applies[1].find((x) => x.id === 'filter').value).toBe('');
    await expect(
        host(page).getByRole('textbox', { name: 'Readonly query input', exact: true }),
    ).toHaveJSProperty('readOnly', true);
    await expect(
        host(page).getByRole('textbox', { name: 'Disabled query input', exact: true }),
    ).toBeDisabled();
    for (const flag of ['Toggle busy', 'Toggle disabled', 'Toggle read-only']) {
        await button(page, flag).click();
        const before = await events(page);
        await expect(host(page).getByRole('checkbox').first()).toBeDisabled();
        await expect(
            host(page).getByRole('button', { name: 'Apply query', exact: true }),
        ).toBeDisabled();
        if (flag === 'Toggle busy') await expect(host(page)).toContainText('Loading rows.');
        await filter(page).evaluate((el) => {
            el.value = 'BLOCKED';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.value = '';
        });
        await host(page).getByRole('checkbox').last().dispatchEvent('change');
        await host(page)
            .getByRole('button', { name: 'Next page', exact: true })
            .dispatchEvent('click');
        await host(page)
            .getByRole('button', { name: 'Apply query', exact: true })
            .dispatchEvent('click');
        await host(page)
            .getByRole('button', { name: 'Select Repeated (row 1)', exact: true })
            .dispatchEvent('click');
        expect(await events(page)).toEqual(before);
        await button(page, flag).click();
    }
});
test('five themes and unrelated context updates retain query, row DOM and focus with long labels and narrow scrolling', async ({
    page,
}) => {
    const input = filter(page),
        sort = host(page).getByRole('combobox', { name: 'Primary sort', exact: true }),
        checks = host(page).getByRole('checkbox');
    await input.fill('  retained draft e\u0301  ');
    await expect
        .poll(async () => (await state(page)).query.inputs.find((x) => x.id === 'filter').value)
        .toBe('  retained draft e\u0301  ');
    const before = await state(page),
        counts = await events(page);
    const textNode = await input.elementHandle(),
        sortNode = await sort.elementHandle(),
        rowNode = await checks.first().elementHandle();
    const fontSize = await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    const themes = [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'grid-frame',
        'default',
    ];
    for (const [index, theme] of themes.entries()) {
        const focus = index % 2 ? sort : input;
        await focus.focus();
        await button(page, theme).evaluate((el) => el.click());
        await expect(host(page)).toHaveClass(
            theme === 'grid-frame' ? 'theme-default' : 'theme-' + theme,
        );
        await expect(focus).toBeFocused();
        await button(page, 'Refresh list context').evaluate((el) => el.click());
        await expect(focus).toBeFocused();
        expect(await input.evaluate((el, old) => el === old, textNode)).toBe(true);
        expect(await sort.evaluate((el, old) => el === old, sortNode)).toBe(true);
        expect(await checks.first().evaluate((el, old) => el === old, rowNode)).toBe(true);
        expect(await state(page)).toEqual(before);
        expect(await events(page)).toEqual(counts);
        await expect(input).toHaveValue('  retained draft e\u0301  ');
        if (theme === 'high-contrast')
            expect(
                await input.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
            ).toBeGreaterThan(fontSize);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    }
    const scroll = host(page).getByRole('region', { name: 'Controlled list', exact: true });
    await scroll.focus();
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => scroll.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
});
