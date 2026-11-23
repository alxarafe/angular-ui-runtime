import { test, expect } from '@playwright/test';
test('UUID and lossless temporal text adapters retain exact drafts, feedback and independent dirty state', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/default-theme/?scenario=validation');
    const controls = {
        uuid: page.getByLabel('UUID value', { exact: true }),
        date: page.getByLabel('Gregorian date (text adapter)', { exact: true }),
        clock: page.getByLabel('Local time (text adapter)', { exact: true }),
        instant: page.getByLabel('Offset instant (text adapter)', { exact: true }),
    };
    const result = (id) => page.getByTestId('scalar-result-' + id);
    const stored = (id) => page.getByTestId('scalar-input-' + id);
    const feedback = (id) => page.locator('#' + id + '-feedback');
    const dirty = page.getByTestId('validation-dirty');
    const accepted = {
        uuid: '123e4567-e89b-12d3-a456-426614174000',
        date: '2024-02-29',
        clock: '12:30:00.1234567',
        instant: '2026-11-23T18:00:00.1234567+01:00',
    };
    await expect(dirty).toHaveText('clean');
    for (const id of Object.keys(controls)) {
        await expect(controls[id]).toHaveValue(accepted[id]);
        await expect(result(id)).toHaveText('valid');
        await expect(page.locator(`aur-form-field[data-aur-field="${id}"]`)).toHaveAttribute(
            'aria-describedby',
            id + '-feedback',
        );
    }
    const drafts = {
        uuid: 'not-a-uuid',
        date: '2025-02-29',
        clock: '12:30:00.',
        instant: '2026-11-23T18:00:00.1234567+',
    };
    for (const id of Object.keys(controls)) {
        await controls[id].fill(drafts[id]);
        await expect(stored(id)).toHaveText(JSON.stringify({ kind: 'value', value: drafts[id] }));
        await expect(result(id)).toHaveText('invalid');
        await expect(feedback(id)).toBeVisible();
    }
    await expect(feedback('uuid')).toContainText('canonical hyphenated UUID');
    await expect(feedback('date')).toContainText('valid calendar/time');
    for (const theme of [
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'grid-frame',
        'default',
    ]) {
        await page.getByRole('button', { name: theme, exact: true }).click();
        await expect(page.getByRole('button', { name: theme, exact: true })).toHaveAttribute(
            'aria-pressed',
            'true',
        );
        for (const id of Object.keys(controls)) {
            await expect(controls[id]).toHaveValue(drafts[id]);
            await expect(controls[id]).toBeEditable();
            await expect(result(id)).toHaveText('invalid');
            await expect(feedback(id)).toBeVisible();
            await expect(page.locator(`aur-form-field[data-aur-field="${id}"]`)).toHaveAttribute(
                'aria-describedby',
                id + '-feedback',
            );
        }
        await expect(dirty).toHaveText('dirty');
    }
    await controls.uuid.fill(accepted.uuid.toUpperCase());
    await expect(result('uuid')).toHaveText('valid');
    await expect(controls.uuid).toHaveValue(accepted.uuid.toUpperCase());
    await controls.date.fill(accepted.date);
    await controls.clock.fill(accepted.clock);
    // Same instant as both range endpoints, but different lexical editing value.
    await controls.instant.fill('2026-11-23T17:00:00.1234567Z');
    for (const id of Object.keys(controls)) await expect(result(id)).toHaveText('valid');
    await expect(controls.clock).toHaveValue('12:30:00.1234567');
    await expect(dirty).toHaveText('dirty');
    await expect(controls.instant).toHaveValue('2026-11-23T17:00:00.1234567Z');
    await controls.uuid.fill(accepted.uuid);
    await controls.instant.fill(accepted.instant);
    await expect(dirty).toHaveText('clean');
    for (const id of Object.keys(controls)) await expect(feedback(id)).toHaveText('Locally valid.');
    expect(errors).toEqual([]);
});
