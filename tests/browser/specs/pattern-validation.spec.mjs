import { test, expect } from '@playwright/test';
test('local patterns and server obligations stay distinct through invalid drafts, reversion and themes', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/default-theme/?scenario=validation');
    const local = page.getByLabel('Local pattern code', { exact: true });
    const server = page.getByLabel('Server pattern code', { exact: true });
    const result = (id) => page.getByTestId('scalar-result-' + id);
    const checks = (id) => page.getByTestId('scalar-checks-' + id);
    const feedback = (id) => page.locator('#' + id + '-feedback');
    const dirty = page.getByTestId('validation-dirty');
    await expect(result('localCode')).toHaveText('valid');
    await expect(result('serverCode')).toHaveText('pending');
    await expect(checks('serverCode')).toHaveText('1');
    await expect(feedback('serverCode')).toContainText('Pending server validation.');
    await expect(dirty).toHaveText('clean'); // Clean does not certify the server pattern.
    await local.fill('bad code ');
    await expect(result('localCode')).toHaveText('invalid');
    await expect(feedback('localCode')).toContainText('required whole-input pattern');
    await server.fill('A');
    await expect(result('serverCode')).toHaveText('invalid');
    await expect(feedback('serverCode')).toContainText('minimum length');
    await expect(feedback('serverCode')).toContainText(
        'This pattern requires server confirmation.',
    );
    await expect(checks('serverCode')).toHaveText('1');
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
        await expect(local).toHaveValue('bad code ');
        await expect(server).toHaveValue('A');
        for (const id of ['localCode', 'serverCode']) {
            await expect(result(id)).toHaveText('invalid');
            await expect(feedback(id)).toBeVisible();
            await expect(page.locator(`aur-form-field[data-aur-field="${id}"]`)).toHaveAttribute(
                'aria-describedby',
                id + '-feedback',
            );
        }
        await expect(feedback('serverCode')).toContainText(
            'This pattern requires server confirmation.',
        );
        await expect(checks('serverCode')).toHaveText('1');
        await expect(dirty).toHaveText('dirty');
    }
    await local.fill('CODE_2');
    await expect(result('localCode')).toHaveText('valid');
    await expect(checks('localCode')).toHaveText('0');
    await server.fill('SERVER_OTHER');
    await expect(result('serverCode')).toHaveText('pending');
    await expect(feedback('serverCode')).toContainText('Pending server validation.');
    await expect(checks('serverCode')).toHaveText('1');
    await expect(dirty).toHaveText('dirty');
    await local.fill('CODE_1');
    await server.fill('SERVER_CODE');
    await expect(dirty).toHaveText('clean');
    await expect(result('localCode')).toHaveText('valid');
    await expect(result('serverCode')).toHaveText('pending');
    await expect(checks('serverCode')).toHaveText('1');
    expect(errors).toEqual([]);
});
