import { test, expect } from '@playwright/test';
const custom = (page, name) => page.getByRole('textbox', { name: `Custom ${name}`, exact: true });
test('mixed slots mount once in group order and retain local state, DOM and focus across visual changes', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (event) => {
        if (event.type() === 'error') errors.push(event.text());
    });
    await page.goto('/default-theme/?scenario=form-slots');
    const host = page.locator('aur-form');
    await expect(host.locator('qa-slot-editor')).toHaveCount(2);
    await expect
        .poll(() => page.evaluate(() => globalThis.__aurSlotsQa.diagnostics()))
        .toEqual([
            { code: 'duplicate-slot', id: 'first' },
            { code: 'unknown-slot', id: 'missing' },
        ]);
    await expect(host.locator('[data-aur-form-slot]')).toHaveCount(3);
    expect(
        await host
            .locator('fieldset')
            .first()
            .evaluate((el) =>
                Array.from(el.children)
                    .map((child) => child.tagName)
                    .filter((tag) => tag.startsWith('AUR-')),
            ),
    ).toEqual(['AUR-FORM-FIELD', 'AUR-DETAIL-GRID', 'AUR-FORM-SLOT', 'AUR-FORM-SLOT']);
    expect(
        await host
            .locator('[data-aur-form-slot]')
            .evaluateAll((nodes) => nodes.map((el) => el.dataset.aurSlot)),
    ).toEqual(['first', 'third', 'second']);
    await expect(page.getByText('Must stay uncreated')).toHaveCount(0);
    await custom(page, 'first').fill('Retained local state');
    await custom(page, 'first').focus();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Custom third', exact: true })).toBeFocused();
    const defaultHeight = await custom(page, 'first').evaluate(
        (el) => el.getBoundingClientRect().height,
    );
    await expect(page.getByTestId('slot-change')).toHaveText('Retained local state');
    const first = await custom(page, 'first').elementHandle();
    const component = await host.locator('qa-slot-editor').first().elementHandle();
    for (const theme of [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'form-frame',
        'default',
    ]) {
        await custom(page, 'first').focus();
        await page.getByRole('button', { name: theme, exact: true }).evaluate((el) => el.click());
        await expect(custom(page, 'first')).toBeFocused();
        if (theme === 'high-contrast')
            expect(
                await custom(page, 'first').evaluate((el) => el.getBoundingClientRect().height),
            ).toBeGreaterThan(defaultHeight);
        expect(await custom(page, 'first').evaluate((el, old) => el === old, first)).toBe(true);
        expect(
            await host
                .locator('qa-slot-editor')
                .first()
                .evaluate((el, old) => el === old, component),
        ).toBe(true);
        await expect(custom(page, 'first')).toHaveValue('Retained local state');
        await page
            .getByRole('button', { name: 'Refresh field', exact: true })
            .evaluate((el) => el.click());
        await expect(custom(page, 'first')).toBeFocused();
        await page.getByRole('button', { name: 'First section', exact: true }).click();
        await expect(custom(page, 'first')).toBeHidden();
        await page.getByRole('button', { name: 'First section', exact: true }).click();
        await expect(custom(page, 'first')).toHaveValue('Retained local state');
        await page.getByRole('tab', { name: 'First tab', exact: true }).focus();
        await page.keyboard.press('ArrowRight');
        await expect(page.getByRole('tab', { name: 'Second tab', exact: true })).toBeFocused();
        await custom(page, 'second').fill('Second draft');
        await page.getByRole('tab', { name: 'Second tab', exact: true }).focus();
        await page.keyboard.press('Home');
        await expect(custom(page, 'first')).toHaveValue('Retained local state');
        expect(await custom(page, 'first').evaluate((el, old) => el === old, first)).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
    }
    await page.getByRole('button', { name: 'Toggle read-only', exact: true }).click();
    await expect(custom(page, 'first')).toHaveJSProperty('readOnly', true);
    await custom(page, 'first').evaluate((el) => {
        el.value = 'Blocked';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.value = 'Retained local state';
    });
    await expect(page.getByTestId('slot-change')).toHaveText('Retained local state');
    await expect(
        page.getByRole('textbox', { name: 'Standard title', exact: true }),
    ).toHaveJSProperty('readOnly', true);
    await page.getByRole('button', { name: 'Inspect slots', exact: true }).click();
    await expect(page.getByTestId('slot-action')).toHaveText('inspect');
    await page.getByRole('button', { name: 'Toggle custom disabled', exact: true }).click();
    await expect(custom(page, 'first')).toBeDisabled();
    await page.getByRole('button', { name: 'Toggle custom disabled', exact: true }).click();
    await page.getByRole('button', { name: 'Toggle read-only', exact: true }).click();
    await expect(custom(page, 'first')).toBeEnabled();
    await expect(custom(page, 'first')).toHaveValue('Retained local state');
    await expect(page.getByTestId('slot-lifetime')).toHaveText('2/0');
    await page.getByRole('tab', { name: 'Second tab', exact: true }).click();
    await expect(custom(page, 'second')).toHaveValue('Second draft');
    await page.getByRole('button', { name: 'Toggle form mounted', exact: true }).click();
    await expect(host).toHaveCount(0);
    // Refresh after view destruction so the consumer lifetime counter is observed.
    await page.getByRole('button', { name: 'Refresh field', exact: true }).click();
    await expect(page.getByTestId('slot-lifetime')).toHaveText('2/2');
    expect(errors).toEqual([]);
});

test('initial readonly context reaches custom components and outputs remain application owned', async ({
    page,
}) => {
    await page.goto('/default-theme/?scenario=form-slots&readonly=1');
    await expect(custom(page, 'first')).toHaveJSProperty('readOnly', true);
    await expect(page.getByTestId('slot-change')).toHaveText('');
    const node = await custom(page, 'first').elementHandle();
    await page.getByRole('button', { name: 'Toggle read-only', exact: true }).click();
    await custom(page, 'first').fill('Application event');
    await expect(page.getByTestId('slot-change')).toHaveText('Application event');
    expect(await custom(page, 'first').evaluate((el, old) => el === old, node)).toBe(true);
    await expect(page.getByTestId('slot-lifetime')).toHaveText('2/0');
});
