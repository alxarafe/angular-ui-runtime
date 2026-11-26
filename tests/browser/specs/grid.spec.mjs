import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
    errors.set(page, []);
    page.on('pageerror', (error) => errors.get(page).push(error.message));
    await page.goto('/default-theme/?scenario=grid');
    await expect(page.getByRole('heading', { name: 'Neutral grid QA' })).toBeVisible();
});
test.afterEach(async ({ page }) => {
    expect(errors.get(page)).toEqual([]);
});
const first = (page) =>
    page
        .locator('aur-detail-grid')
        .filter({ has: page.getByRole('table', { name: 'First rows', exact: true }) });
const event = (page) => page.getByTestId('grid-event');
test('field reveal scopes the header despite earlier grid cells sharing its field ID', async ({
    page,
}) => {
    const header = page.getByLabel('Document title', { exact: true }),
        grid = first(page);
    const earlier = grid.locator('aur-form-field[data-aur-field="title"]').first();
    await expect(earlier.getByLabel('Quantity — Row a', { exact: true })).toBeVisible();
    expect(
        await earlier.evaluate(
            (node) =>
                !!(
                    node.compareDocumentPosition(document.getElementById('grid-title')) &
                    Node.DOCUMENT_POSITION_FOLLOWING
                ),
        ),
    ).toBe(true);
    for (const theme of ['default', 'grid-frame']) {
        await page.getByRole('button', { name: theme, exact: true }).click();
        await expect(page.getByRole('button', { name: theme, exact: true })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        await page.getByRole('button', { name: 'Reveal document title', exact: true }).click();
        await expect(header).toBeFocused();
        await expect(grid.getByLabel('Quantity — Row a', { exact: true })).not.toBeFocused();
    }
    await expect(event(page)).toHaveText('');
});
test('duplicate row labels and values have distinct controls/actions after keyed reorder', async ({
    page,
}) => {
    const grid = first(page);
    await page.getByRole('button', { name: 'Use repeated row labels', exact: true }).click();
    const one = grid.getByLabel('Quantity — Repeated row (row 1)', { exact: true });
    const two = grid.getByLabel('Quantity — Repeated row (row 2)', { exact: true });
    await expect(one).toHaveCount(1);
    await expect(two).toHaveCount(1);
    await expect(one).toHaveValue('18446744073709551615');
    await expect(two).toHaveValue('18446744073709551615');
    for (const column of ['Quantity', 'Amount', 'Score', 'Locked'])
        for (const position of [1, 2])
            await expect(
                grid.getByLabel(`${column} — Repeated row (row ${position})`, { exact: true }),
            ).toHaveCount(1);
    for (const action of ['Remove', 'Move up', 'Move down'])
        for (const position of [1, 2])
            await expect(
                grid.getByRole('button', {
                    name: `${action} Repeated row (row ${position})`,
                    exact: true,
                }),
            ).toHaveCount(1);
    await two.evaluate((node) => {
        window.__repeatedRow = node;
    });
    await grid.getByRole('button', { name: 'Move up Repeated row (row 2)', exact: true }).click();
    await expect(event(page)).toContainText('"kind":"move-row"');
    expect(JSON.parse(await event(page).textContent())).toMatchObject({ key: 'b', before: 'a' });
    await expect.poll(() => one.evaluate((node) => node === window.__repeatedRow)).toBe(true);
    await one.fill('18446744073709551616');
    await expect(event(page)).toContainText('"value":"18446744073709551616"');
    expect(JSON.parse(await event(page).textContent())).toMatchObject({ kind: 'cell', key: 'b' });
    for (const action of ['Remove', 'Move up', 'Move down'])
        for (const position of [1, 2])
            await expect(
                grid.getByRole('button', {
                    name: `${action} Repeated row (row ${position})`,
                    exact: true,
                }),
            ).toHaveCount(1);
    await grid.getByRole('button', { name: 'Remove Repeated row (row 2)', exact: true }).click();
    await expect(grid.getByLabel('Quantity — Repeated row', { exact: true })).toHaveValue(
        '18446744073709551616',
    );
    expect(JSON.parse(await event(page).textContent())).toMatchObject({
        kind: 'remove-row',
        key: 'a',
    });
    await expect(
        grid.getByRole('button', { name: 'Remove Repeated row', exact: true }),
    ).toHaveCount(1);
});
test('semantic list empty, single and multiple rows; keyed selection and exact numeric text', async ({
    page,
}) => {
    const list = page.getByRole('table', { name: 'Read-only list', exact: true });
    await expect(list.locator('tbody tr')).toHaveCount(2);
    await expect(list.getByRole('columnheader')).toHaveCount(3);
    await expect(list.locator('tbody tr').first()).toContainText('18446744073709551615');
    await expect(list.locator('tbody tr').first()).toContainText('9223372036854775807.123456789');
    await list.getByRole('button', { name: 'Select Row b', exact: true }).click();
    await expect(page.getByTestId('selection')).toHaveText('b');
    await page.getByRole('button', { name: 'Single list', exact: true }).click();
    await expect(list.locator('tbody tr')).toHaveCount(1);
    await page.getByRole('button', { name: 'Empty list', exact: true }).click();
    await expect(list).toContainText('No rows.');
    await expect(list.getByRole('button')).toHaveCount(0);
});
test('list duplicate selection names avoid suffix collisions and follow stable keys after updates', async ({
    page,
}) => {
    const list = page.getByRole('table', { name: 'Read-only list', exact: true });
    const select = (label) => list.getByRole('button', { name: 'Select ' + label, exact: true });
    const selection = page.getByTestId('selection');
    await page.getByRole('button', { name: 'Use colliding row labels', exact: true }).click();
    for (const label of ['Repeated (row 1) (row 1)', 'Repeated (row 2)', 'Repeated (row 1)'])
        await expect(select(label)).toHaveCount(1);
    expect(
        await list
            .getByRole('button')
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('aria-label'))),
    ).not.toEqual(expect.arrayContaining([expect.stringContaining('private-')]));
    await select('Repeated (row 1) (row 1)').click();
    await expect(selection).toHaveText('private-a');
    const rows = list.locator('tbody tr');
    await expect(rows).toHaveCount(3);
    const originalRows = await rows.elementHandles();
    await first(page)
        .getByRole('button', { name: 'Move up Repeated (row 2)', exact: true })
        .click();
    // Position-based labels exist before and after the move; wait for retained rows to reorder.
    await expect
        .poll(() =>
            rows.evaluateAll(
                (nodes, originals) => ({
                    order: nodes.map((node) => originals.indexOf(node)),
                    labels: nodes.map((node) =>
                        node.querySelector('button')?.getAttribute('aria-label'),
                    ),
                }),
                originalRows,
            ),
        )
        .toEqual({
            order: [1, 0, 2],
            labels: [
                'Select Repeated (row 1) (row 1)',
                'Select Repeated (row 2)',
                'Select Repeated (row 1)',
            ],
        });
    await select('Repeated (row 2)').click();
    await expect(selection).toHaveText('private-a');
    await select('Repeated (row 1) (row 1)').click();
    await expect(selection).toHaveText('private-b');
    await first(page).getByRole('button', { name: 'Remove Repeated (row 2)', exact: true }).click();
    await expect(select('Repeated')).toHaveCount(1);
    await expect(select('Repeated (row 1)')).toHaveCount(1);
    await select('Repeated').click();
    await expect(selection).toHaveText('private-b');
    await page.getByRole('button', { name: 'Empty list', exact: true }).click();
    await expect(list.getByRole('button')).toHaveCount(0);
});
test('parent-owned header/two collections, cell/add/remove/move and deletion index shifts', async ({
    page,
}) => {
    await page.getByLabel('Document title', { exact: true }).fill('Header draft');
    const grid = first(page),
        amount = grid.getByLabel('Amount — Row b', { exact: true });
    await amount.fill('1e-');
    await expect(amount).toHaveValue('1e-');
    await expect(event(page)).toContainText('"value":"1e-"');
    let intent = JSON.parse(await event(page).textContent());
    expect(intent).toMatchObject({
        kind: 'cell',
        collectionId: 'first',
        key: 'b',
        field: 'amount',
        value: '1e-',
        path: [
            { kind: 'property', name: 'first' },
            { kind: 'row', key: 'b' },
            { kind: 'property', name: 'amount' },
        ],
    });
    await grid.getByRole('button', { name: 'Move up Row b', exact: true }).click();
    await expect(grid.locator('tbody tr').first()).toContainText('Row b');
    await grid.getByRole('button', { name: 'Move down Row b', exact: true }).click();
    await expect.poll(async () => JSON.parse(await event(page).textContent()).before).toBe(null);
    expect(JSON.parse(await event(page).textContent())).toMatchObject({
        kind: 'move-row',
        key: 'b',
        before: null,
    });
    await grid.getByRole('button', { name: 'Remove Row a', exact: true }).click();
    await expect(grid.locator('tbody tr')).toHaveCount(1);
    await amount.fill('-');
    await expect(event(page)).toContainText('"value":"-"');
    expect(JSON.parse(await event(page).textContent()).key).toBe('b');
    await grid.getByRole('button', { name: 'Add row to First rows', exact: true }).click();
    await expect(grid.locator('tbody tr')).toHaveCount(2);
    expect(JSON.parse(await event(page).textContent())).toMatchObject({
        kind: 'add-row',
        collectionId: 'first',
    });
    await grid.getByRole('button', { name: 'Move up Row new-1', exact: true }).click();
    await expect(event(page)).toContainText('"key":"new-1"');
    expect(JSON.parse(await event(page).textContent())).toMatchObject({
        key: 'new-1',
        before: 'b',
    });
    await page.getByRole('tab', { name: 'Second collection', exact: true }).click();
    const second = page.getByRole('table', { name: 'Second rows', exact: true });
    await expect(second).toBeVisible();
    await expect(second.getByRole('button', { name: /Move/ })).toHaveCount(0);
    await second.getByLabel('Quantity — Row x', { exact: true }).fill('18446744073709551616');
    await expect(event(page)).toContainText('"collectionId":"second"');
    expect(JSON.parse(await event(page).textContent()).collectionId).toBe('second');
    await second.getByRole('button', { name: 'Remove Row x', exact: true }).click();
    await expect(second).toContainText('No rows.');
    await expect(page.getByLabel('Document title', { exact: true })).toHaveValue('Header draft');
    await page.getByRole('button', { name: 'Toggle placement', exact: true }).click();
    await expect(page.getByRole('table', { name: 'First rows', exact: true })).toBeVisible();
    await expect(second).toBeVisible();
    await expect(page.locator('aur-detail-grid')).toHaveCount(2);
    const html = await page.locator('aur-form').innerHTML();
    expect(html).not.toMatch(/private-collection|private-path|unknown-private/);
});
test('all five themes and frame replacement retain exact drafts, logical focus and optional cell controls', async ({
    page,
}, info) => {
    const grid = first(page),
        quantity = grid.getByLabel('Quantity — Row a', { exact: true });
    await quantity.fill('18446744073709551616');
    await quantity.evaluate((node) => {
        window.__gridNative = node;
    });
    for (const id of [
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'grid-frame',
        'default',
    ]) {
        await quantity.press('Alt+t');
        await expect(page.getByRole('button', { name: id, exact: true })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        await expect(quantity).toBeFocused();
        await expect(quantity).toHaveValue('18446744073709551616');
        if (['cyberpunk', 'vintage', 'high-contrast'].includes(id))
            expect(await quantity.evaluate((node) => node === window.__gridNative)).toBe(true);
    }
    const score = grid.getByLabel('Score — Row a', { exact: true });
    await score.focus();
    await score.press('ArrowRight');
    await expect(event(page)).toContainText('"field":"score"');
    await score.press('Alt+t');
    await expect(page.getByRole('button', { name: 'alternative', exact: true })).toHaveAttribute(
        'aria-pressed',
        'true',
    );
    await expect(score).toBeFocused();
    await expect(score).toHaveJSProperty('tagName', 'SELECT');
    await expect(score.locator('option:checked')).toHaveText('4');
    // Packaged overrides select the active numeric alternative; the grid-frame
    // theme has no control override and falls directly back to default stars.
    for (const id of ['cyberpunk', 'vintage', 'high-contrast', 'grid-frame', 'default']) {
        await score.press('Alt+t');
        await expect(page.getByRole('button', { name: id, exact: true })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        await expect(score).toBeFocused();
        await expect(score).toHaveJSProperty(
            'tagName',
            ['default', 'grid-frame'].includes(id) ? 'INPUT' : 'SELECT',
        );
    }
    await expect(score).toHaveValue('4');
    await expect(grid.getByLabel('Locked — Row a', { exact: true })).toBeDisabled();
    await mkdir('/artifacts/testbed/grids', { recursive: true });
    for (const id of [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'grid-frame',
    ]) {
        await page.getByRole('button', { name: id, exact: true }).click();
        await expect(page.getByRole('button', { name: id, exact: true })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        await expect(quantity).toHaveValue('18446744073709551616');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        const region = grid.getByRole('region', { name: 'First rows', exact: true });
        if (info.project.name === 'mobile')
            expect(await region.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
        await region.evaluate((node) => {
            node.scrollLeft = node.scrollWidth;
        });
        await grid.getByRole('button', { name: 'Remove Row a', exact: true }).focus();
        await expect(grid.getByRole('button', { name: 'Remove Row a', exact: true })).toBeFocused();
        await page.screenshot({
            path: `/artifacts/testbed/grids/${id}-${info.project.name}.png`,
            fullPage: true,
        });
    }
});
test('read-only, disabled and cell flags suppress synthetic edits and row actions', async ({
    page,
}) => {
    const grid = first(page);
    for (const flag of ['Toggle read-only', 'Toggle disabled']) {
        await page.getByRole('button', { name: flag, exact: true }).click();
        if (flag === 'Toggle read-only')
            await expect(grid.getByLabel('Quantity — Row a', { exact: true })).toHaveJSProperty(
                'readOnly',
                true,
            );
        else await expect(grid.getByLabel('Quantity — Row a', { exact: true })).toBeDisabled();
        await grid.getByLabel('Quantity — Row a', { exact: true }).evaluate((node) => {
            node.value = 'bad';
            node.dispatchEvent(new Event('input', { bubbles: true }));
        });
        for (const name of [
            'Add row to First rows',
            'Remove Row a',
            'Move up Row a',
            'Move down Row a',
        ])
            await grid
                .getByRole('button', { name, exact: true })
                .evaluate((node) => node.dispatchEvent(new MouseEvent('click', { bubbles: true })));
        const score = grid.getByLabel('Score — Row a', { exact: true });
        await score.evaluate((node) => {
            node.value = '5';
            node.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await expect(event(page)).toHaveText('');
        await expect(grid.locator('tbody tr')).toHaveCount(2);
        await page.getByRole('button', { name: flag, exact: true }).click();
    }
    await grid.getByLabel('Locked — Row a', { exact: true }).evaluate((node) => {
        node.value = 'bad';
        node.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(event(page)).toHaveText('');
});
