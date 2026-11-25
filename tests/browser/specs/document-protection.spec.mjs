import { test, expect } from '@playwright/test';
for (const [label, reason] of [
    ['Route', 'route'],
    ['Back', 'back'],
    ['Replace record', 'programmatic'],
    ['Discard', 'discard'],
]) {
    test(`${reason} synthetic adapter preserves cancelled draft/focus and restores accepted content`, async ({
        page,
    }) => {
        await page.goto('/default-theme/?scenario=document-protection');
        const input = page.getByRole('textbox', { name: 'Document draft' });
        const action = page.getByRole('button', { name: label, exact: true });
        await expect(page.getByTestId('unload')).toHaveText('false');
        await action.click();
        await expect(page.getByTestId('decision')).toHaveText(reason + ':allowed');
        await expect(page.getByTestId('prompts')).toHaveText('0');
        await input.fill('1e-');
        await expect(page.getByTestId('unload')).toHaveText('true');
        await action.click();
        await page.getByRole('button', { name: 'Cancel', exact: true }).click();
        await expect(input).toHaveValue('1e-');
        await expect(action).toBeFocused();
        await expect(page.getByTestId('decision')).toHaveText(reason + ':denied');
        await action.click();
        await page.getByRole('button', { name: 'Confirm', exact: true }).click();
        await expect(input).toHaveValue('Accepted');
        await expect(page.getByTestId('unload')).toHaveText('false');
    });
}
test('concurrent synthetic requests and stale dialog never lose later edits; lifecycle cleanup', async ({
    page,
}) => {
    await page.goto('/default-theme/?scenario=document-protection');
    const input = page.getByRole('textbox', { name: 'Document draft' });
    await input.fill('draft');
    await page.getByRole('button', { name: 'Route', exact: true }).click();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page.getByTestId('prompts')).toHaveText('1');
    await input.fill('later');
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(input).toHaveValue('later');
    await expect(page.getByTestId('decision')).toHaveText('route:denied');
    const prevented = await page.evaluate(() => {
        const e = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(e);
        return e.defaultPrevented;
    });
    expect(prevented).toBe(true);
    await page.getByRole('button', { name: 'Destroy lifecycle owner' }).click();
    await expect(page.getByTestId('unload')).toHaveText('false');
    expect(
        await page.evaluate(() => {
            const e = new Event('beforeunload', { cancelable: true });
            window.dispatchEvent(e);
            return e.defaultPrevented;
        }),
    ).toBe(false);
});
