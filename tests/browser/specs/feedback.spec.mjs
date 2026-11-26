import { test, expect } from '@playwright/test';
const summary = (page) => page.getByRole('region', { name: 'Document feedback', exact: true });
const events = async (page) => JSON.parse(await page.getByTestId('feedback-events').textContent());
const state = (page) => page.getByTestId('feedback-state').textContent();
const action = (page, message) => summary(page).getByRole('button', { name: new RegExp(message) });
const errors = new WeakMap();
test.beforeEach(async ({ page }) => {
    const failures = [];
    errors.set(page, failures);
    page.on('pageerror', (e) => failures.push(e.message));
    page.on('console', (e) => {
        if (e.type() === 'error') failures.push(e.text());
    });
    await page.goto('/default-theme/?scenario=feedback');
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));
test('simultaneous root/path errors and deferred checks; first-invalid skips unknown/disabled paths and reveals hidden fields exactly once', async ({
    page,
}) => {
    const before = await state(page);
    const errorRegion = summary(page).getByRole('region', { name: 'Errors', exact: true });
    await expect(errorRegion).toContainText('Root failure one');
    await expect(errorRegion).toContainText('Root failure two');
    await expect(errorRegion.getByRole('button', { name: /Root failure/ })).toHaveCount(0);
    await expect(errorRegion).toContainText('Cell failure one');
    await expect(errorRegion).toContainText('Cell failure two');
    await expect(errorRegion).not.toContainText('Authoritative check pending');
    await expect(
        summary(page).getByRole('region', { name: 'Deferred checks', exact: true }),
    ).toContainText('Authoritative check pending');
    const first = summary(page).getByRole('button', { name: 'Focus first error', exact: true });
    await first.focus();
    await page.keyboard.press('Enter');
    const hidden = page.getByRole('textbox', { name: 'Hidden error', exact: true });
    await expect(hidden).toBeFocused();
    await expect(page.getByRole('tab', { name: 'Details', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await expect(page.getByRole('button', { name: 'Hidden section', exact: true })).toHaveAttribute(
        'aria-expanded',
        'true',
    );
    await expect.poll(async () => (await events(page)).results).toEqual([false, false, true]);
    expect((await events(page)).requests.map((p) => p[0].name)).toEqual([
        'unknown',
        'disabled',
        'hidden',
    ]);
    expect(await state(page)).toBe(before);
    expect((await events(page)).edits).toBe(0);
    expect((await events(page)).unexpected).toBe(0);
    await page.getByRole('button', { name: 'Return to feedback', exact: true }).click();
    await expect(summary(page)).toBeFocused();
    await first.evaluate((el) => {
        el.click();
        el.click();
    });
    await expect(hidden).toBeFocused();
    await expect.poll(async () => (await events(page)).requests.length).toBe(6);
    await expect.poll(async () => (await events(page)).results.length).toBe(6);
});
test('collection, keyed row and cell focus use existing reveal ports; unknown paths preserve focus and report failure', async ({
    page,
}) => {
    const before = await state(page);
    await action(page, 'Collection failure').click();
    await expect(page.getByRole('region', { name: 'Keyed details', exact: true })).toBeFocused();
    await action(page, 'Row failure').focus();
    await page.keyboard.press('Space');
    const cell = page.getByRole('textbox', { name: /^Editable cell/ });
    await expect(cell).toBeFocused();
    await expect(page.getByRole('textbox', { name: /^Disabled cell/ })).toBeDisabled();
    for (const message of ['Cell failure one', 'Cell failure two']) {
        const count = (await events(page)).requests.length;
        await action(page, message).click();
        await expect(cell).toBeFocused();
        expect((await events(page)).requests.length).toBe(count + 1);
        expect((await events(page)).requests.at(-1)).toEqual([
            { kind: 'property', name: 'rows' },
            { kind: 'row', key: 'opaque /?#' },
            { kind: 'property', name: 'value' },
        ]);
    }
    for (const message of [
        'Unknown field failure',
        'Unknown cell failure',
        'Removed row failure',
    ]) {
        const button = action(page, message),
            count = (await events(page)).results.length;
        await button.focus();
        await page.keyboard.press('Enter');
        await expect.poll(async () => (await events(page)).results.length).toBe(count + 1);
        await expect(button).toBeFocused();
        await expect(summary(page).getByRole('status')).toHaveText(
            'No focusable target for this feedback.',
        );
        expect((await events(page)).results.at(-1)).toBe(false);
    }
    expect(await state(page)).toBe(before);
    expect((await events(page)).edits).toBe(0);
});
test('five themes and structural frame replacement retain summary DOM/focus and leave the session unchanged', async ({
    page,
}) => {
    const before = await state(page),
        button = action(page, 'Unknown field failure'),
        node = await button.elementHandle();
    const height = await button.evaluate((el) => el.getBoundingClientRect().height);
    for (const theme of [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'form-frame',
        'default',
    ]) {
        await button.focus();
        const count = (await events(page)).requests.length;
        await page.getByRole('button', { name: theme, exact: true }).evaluate((el) => el.click());
        await expect(button).toBeFocused();
        expect(await button.evaluate((el, old) => el === old, node)).toBe(true);
        await page
            .getByRole('button', { name: 'Refresh unrelated context', exact: true })
            .evaluate((el) => el.click());
        await expect(button).toBeFocused();
        expect((await events(page)).requests.length).toBe(count);
        if (theme === 'high-contrast')
            expect(
                await button.evaluate((el) => el.getBoundingClientRect().height),
            ).toBeGreaterThan(height);
        await action(page, 'Cell failure one').click();
        await expect(page.getByRole('textbox', { name: /^Editable cell/ })).toBeFocused();
        expect(await state(page)).toBe(before);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    }
});
test('pending reveal does not steal moved focus and completes once when its form is destroyed', async ({
    page,
}) => {
    await page.getByRole('button', { name: 'Move focus during reveal', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'Outside focus target', exact: true }),
    ).toBeFocused();
    await expect.poll(async () => (await events(page)).results).toEqual([false]);
    await page.getByRole('button', { name: 'Destroy pending form', exact: true }).click();
    await expect(page.locator('aur-form')).toHaveCount(0);
    await expect.poll(async () => (await events(page)).results).toEqual([false, false]);
    expect((await events(page)).edits).toBe(0);
});
