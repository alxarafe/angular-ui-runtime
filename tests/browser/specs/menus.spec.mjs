import { test, expect } from '@playwright/test';
const ids = ['primary0', 'primary1', 'secondary0', 'secondary1', 'account0', 'account1'];
test('six independent menus use exactly one ordered placement across all themes and retain owned nodes', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/default-theme/?scenario=menus');
    await page.getByRole('button', { name: 'More menus', exact: true }).click();
    await expect(page.locator('[data-aur-menu]')).toHaveCount(6);
    await expect(page.getByText('Legacy should be suppressed', { exact: true })).toHaveCount(0);
    await expect(page.getByTestId('menu-diagnostics')).toContainText('mixed-navigation');
    await expect(page.getByTestId('menu-diagnostics')).toContainText('conflicting-placement');
    await page.getByLabel('Owned draft').fill('Retained draft');
    await page.locator('[data-aur-menu="primary0"]').evaluate((el) => (el.qaIdentity = 'retained'));
    for (const theme of [
        'menu-regions',
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'menu-regions',
    ]) {
        await page.getByRole('button', { name: theme, exact: true }).click();
        await expect(page.locator('[data-aur-menu]')).toHaveCount(6);
        await expect(page.locator('[data-aur-menu-item]')).toHaveCount(24);
        expect(
            await page.locator('[data-aur-menu="primary0"]').evaluate((el) => el.qaIdentity),
        ).toBe('retained');
        await expect(page.getByLabel('Owned draft')).toHaveValue('Retained draft');
        const fallback = page.getByRole('region', { name: 'More menus', exact: true });
        expect(
            await fallback
                .locator('[data-aur-menu]')
                .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-aur-menu'))),
        ).toEqual(theme === 'menu-regions' ? ids.slice(1) : ids);
        await expect(page.locator('aur-menu-view nav')).toHaveCount(6);
    }
    expect(errors).toEqual([]);
    await page.getByRole('button', { name: 'Zero menus', exact: true }).click();
    await expect(page.locator('[data-aur-menu]')).toHaveCount(0);
    await page.getByRole('button', { name: 'One menu', exact: true }).click();
    await expect(page.locator('[data-aur-menu]')).toHaveCount(1);
    await page.getByRole('button', { name: 'Many menus', exact: true }).click();
    await expect(page.locator('[data-aur-menu]')).toHaveCount(6);
});
test('overflow, nested keyboard controls, disabled/current items and native link callback', async ({
    page,
}) => {
    await page.goto('/default-theme/?scenario=menus');
    const toggle = page.getByRole('button', { name: 'More menus', exact: true });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const first = page.locator('[data-aur-menu="primary0"]');
    const summary = first.locator('summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(first.locator('details')).toHaveAttribute('open', '');
    await expect(summary).toHaveAttribute('aria-current', 'page');
    await page.keyboard.press('Tab');
    await expect(first.getByRole('button', { name: 'Repeated action', exact: true })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('menu-intent')).toHaveText('primary0/action');
    await expect(first.getByRole('button', { name: 'Disabled action' })).toBeDisabled();
    await first.getByRole('button', { name: 'Disabled action' }).dispatchEvent('click');
    await expect(page.getByTestId('menu-intent')).toHaveText('primary0/action');
    const link = first.getByRole('link', { name: 'Native link' });
    await expect(link).toHaveAttribute('href', '#native');
    await expect(link).toHaveAttribute('aria-current', 'page');
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('menu-links')).toHaveText('1');
    await expect(page.getByTestId('menu-intent')).toHaveText('primary0/native');
    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
    await toggle.click();
    await page.getByRole('button', { name: 'Close menus', exact: true }).click();
    await expect(toggle).toBeFocused();
});
test('long labels and enlarged high contrast controls remain reachable without horizontal overflow', async ({
    page,
}) => {
    await page.goto('/default-theme/?scenario=menus');
    await page.getByRole('button', { name: 'high-contrast', exact: true }).click();
    await page.locator('aur-theme-shell').evaluate((el) => (el.style.fontSize = '24px'));
    await page.getByRole('button', { name: 'More menus', exact: true }).click();
    for (const summary of await page.locator('summary').all()) await summary.click();
    for (const button of await page
        .getByRole('button', { name: 'Repeated action', exact: true })
        .all()) {
        await button.scrollIntoViewIfNeeded();
        await expect(button).toBeVisible();
        const box = await button.boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
    );
});
