import { test, expect } from '@playwright/test';
test('local INTEGER feedback retains invalid editable drafts across themes and accepts exact correction', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/default-theme/?scenario=validation');
    const input = page.getByLabel('Exact quantity', { exact: true });
    const result = page.getByTestId('validation-state');
    const feedback = page.locator('#integer-feedback');
    await expect(result).toHaveText('valid');
    await input.fill('1e-');
    await expect(result).toHaveText('invalid');
    await expect(page.locator('aur-form-field')).toHaveAttribute(
        'aria-describedby',
        'integer-feedback',
    );
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText('signed base-ten integer');
    for (const id of [
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'grid-frame',
        'default',
    ]) {
        await page.getByRole('button', { name: id, exact: true }).click();
        await expect(page.getByRole('button', { name: id, exact: true })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        await expect(input).toHaveValue('1e-');
        await expect(input).toBeEditable();
        await expect(result).toHaveText('invalid');
        await expect(feedback).toContainText('signed base-ten integer');
    }
    await input.fill('18446744073709551616');
    await expect(feedback).toContainText('outside the effective capacity');
    await input.fill('+018446744073709551615');
    await expect(result).toHaveText('valid');
    await expect(input).toHaveValue('+018446744073709551615');
    await expect(feedback).toHaveText('Integer is locally valid.');
    await expect(page.getByTestId('validation-dirty')).toHaveText('dirty');
    await input.fill('+001');
    await expect(page.getByTestId('validation-dirty')).toHaveText('clean');
    await expect(result).toHaveText('valid');
    expect(errors).toEqual([]);
});
