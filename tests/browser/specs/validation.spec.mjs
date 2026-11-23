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
    await expect(page.locator('aur-form-field[data-aur-field="quantity"]')).toHaveAttribute(
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

test('DECIMAL preserves exact editable drafts and independent validation/dirty state across themes', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/default-theme/?scenario=validation');
    const input = page.getByLabel('Exact amount', { exact: true });
    const result = page.getByTestId('decimal-validation-state');
    const feedback = page.locator('#decimal-feedback');
    const dirty = page.getByTestId('validation-dirty');
    await expect(input).toHaveValue('9007199254740993.25');
    await expect(result).toHaveText('valid');
    await expect(dirty).toHaveText('clean');
    await expect(page.locator('aur-form-field[data-aur-field="amount"]')).toHaveAttribute(
        'aria-describedby',
        'decimal-feedback',
    );
    await input.fill('1.25e-');
    await expect(result).toHaveText('invalid');
    await expect(feedback).toBeVisible();
    await expect(feedback).toContainText('complete fractional/exponent');
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
        await expect(input).toHaveValue('1.25e-');
        await expect(input).toBeEditable();
        await expect(result).toHaveText('invalid');
        await expect(dirty).toHaveText('dirty');
        await expect(feedback).toContainText('complete fractional/exponent');
    }
    await input.fill('9007199254740993.251');
    await expect(feedback).toContainText('normalized scale');
    await input.fill('9007199254740993.26');
    await expect(feedback).toHaveText('Decimal must be an exact multiple of the declared divisor.');
    await input.fill('9007199254740993.30');
    await expect(result).toHaveText('valid');
    await expect(dirty).toHaveText('dirty');
    await expect(input).toHaveValue('9007199254740993.30');
    await input.fill('+09007199254740993.2500');
    await expect(dirty).toHaveText('clean');
    await expect(result).toHaveText('valid');
    await expect(input).toHaveValue('+09007199254740993.2500');
    await expect(feedback).toHaveText('Decimal is locally valid.');
    expect(errors).toEqual([]);
});
