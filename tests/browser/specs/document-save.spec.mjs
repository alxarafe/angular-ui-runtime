import { test, expect } from '@playwright/test';

test('installed APF save locks edits, preserves exact keyed drafts and reconciles authoritative acceptance across themes', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/default-theme/?scenario=document-save');
    await expect(page.getByRole('heading', { name: 'Document save lifecycle QA' })).toBeVisible();
    const title = page.getByLabel('Document title', { exact: true });
    const quantity = page.getByLabel('External quantity', { exact: true });
    const first = page.getByRole('table', { name: 'First detail rows', exact: true });
    const second = page.getByRole('table', { name: 'Second detail rows', exact: true });
    const save = page.getByRole('button', { name: 'Save document', exact: true });
    const status = page.getByTestId('save-status');
    await title.fill('Draft title');
    await quantity.fill('1e-');
    await save.click();
    await expect(status).toHaveText('idle');
    await expect(page.getByTestId('save-message')).toHaveText('blocked');
    await expect(quantity).toHaveValue('1e-');
    await quantity.fill('2147483647');
    await first.getByLabel('Quantity — Row a', { exact: true }).fill('123456789');
    await first.getByRole('button', { name: 'Move up Row b', exact: true }).click();
    await page.getByRole('button', { name: 'Add row to Second detail rows', exact: true }).click();
    await second.getByLabel('Quantity — Row new-1', { exact: true }).fill('987654321');
    await save.click();
    await expect(status).toHaveText('saving');
    const attempt = JSON.parse(await page.getByTestId('submission').textContent());
    expect(attempt.validation.state).toBe('pending');
    expect(attempt.validation.checks).toEqual([
        { reason: 'server-pattern', path: [{ kind: 'property', name: 'serverCode' }] },
    ]);
    expect(attempt.document.properties.first.rows.map((row) => row.key)).toEqual(['b', 'a']);
    expect(attempt.document.properties.second.rows[1].value.properties.quantity.input.value).toBe(
        '987654321',
    );
    expect(attempt.document.properties.external.input.value).toBe('2147483647');
    await page.getByRole('button', { name: 'Probe duplicate submission' }).click();
    await expect(page.getByTestId('save-message')).toHaveText('submission locked');
    await page.getByRole('button', { name: 'Probe locked edit' }).click();
    await expect(page.getByTestId('save-message')).toHaveText('editing locked');
    for (const theme of [
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'grid-frame',
        'default',
    ]) {
        await page.getByRole('button', { name: theme, exact: true }).click();
        await expect(status).toHaveText('saving');
        await expect(title).toHaveValue('Draft title');
        await expect(title).toBeDisabled();
        await expect(save).toBeDisabled();
        await expect(
            first.getByRole('button', { name: 'Remove Row a', exact: true }),
        ).toBeDisabled();
    }
    await page.getByRole('button', { name: 'Adapter accepts', exact: true }).click();
    await expect(status).toHaveText('idle');
    await expect(title).toHaveValue('Authoritative title');
    await expect(title).toBeEnabled();
    await expect(page.getByTestId('document-dirty')).toHaveText('clean');
    await expect(
        first.locator('tbody tr').first().getByLabel('Quantity — Row b', { exact: true }),
    ).toBeVisible();
    await expect(second.getByLabel('Quantity — Row new-1', { exact: true })).toHaveValue(
        '987654321',
    );
    const accepted = JSON.parse(await page.getByTestId('document-snapshot').textContent());
    expect(
        accepted.properties.first.rows.map((row) => [
            row.key,
            row.value.properties.persistenceId.input.value,
        ]),
    ).toEqual([
        ['b', 'regenerated-b'],
        ['a', 'regenerated-a'],
    ]);
    expect(accepted.properties.second.rows[1].value.properties.persistenceId.input.value).toBe(
        'regenerated-new-1',
    );
    expect(errors).toEqual([]);
});

test('synthetic adapter rejection, conflict and stale replies preserve the editable draft', async ({
    page,
}) => {
    await page.goto('/default-theme/?scenario=document-save');
    const title = page.getByLabel('Document title', { exact: true });
    for (const response of [
        'Adapter validation rejection',
        'Adapter transport failure',
        'Adapter conflict',
    ]) {
        await title.fill(response);
        await page.getByRole('button', { name: 'Save document', exact: true }).click();
        await page.getByRole('button', { name: response, exact: true }).click();
        await expect(page.getByTestId('save-status')).toHaveText('idle');
        await expect(title).toBeEnabled();
        await expect(title).toHaveValue(response);
        await expect(page.getByTestId('document-dirty')).toHaveText('dirty');
        await expect(page.getByTestId('save-feedback')).toContainText(
            'Synthetic adapter rejection',
        );
    }
    await title.fill('Latest attempt');
    await page.getByRole('button', { name: 'Save document', exact: true }).click();
    await expect(page.getByTestId('submission')).toContainText('Latest attempt');
    const current = await page.getByTestId('submission').textContent();
    await page.getByRole('button', { name: 'Replay stale acceptance' }).click();
    await expect(page.getByTestId('save-status')).toHaveText('saving');
    await expect(page.getByTestId('submission')).toHaveText(current);
    await expect(title).toHaveValue('Latest attempt');
    await page.getByRole('button', { name: 'Adapter accepts', exact: true }).click();
    await expect(page.getByTestId('document-dirty')).toHaveText('clean');
});

for (const response of ['Adapter committed', 'Adapter uncertain', 'Adapter incomplete acceptance'])
    test(`${response} needs locked authoritative recovery`, async ({ page }) => {
        await page.goto('/default-theme/?scenario=document-save');
        const title = page.getByLabel('Document title', { exact: true });
        await title.fill('Retained recovery draft');
        await page.getByRole('button', { name: 'Save document', exact: true }).click();
        await page.getByRole('button', { name: response, exact: true }).click();
        await expect(page.getByTestId('save-status')).toHaveText(
            response === 'Adapter committed' ? 'reconciling' : 'recovery',
        );
        await expect(title).toHaveValue('Retained recovery draft');
        await expect(title).toBeDisabled();
        await expect(page.getByTestId('document-dirty')).toHaveText('dirty');
        await page.getByRole('button', { name: 'Probe duplicate submission' }).click();
        await expect(page.getByTestId('save-message')).toHaveText('submission locked');
        await page.getByRole('button', { name: 'Adapter transport failure' }).click();
        await expect(page.getByTestId('save-status')).toHaveText('recovery');
        await expect(title).toBeDisabled();
        await page.getByRole('button', { name: 'Authoritative recovery' }).click();
        await expect(page.getByTestId('save-status')).toHaveText('idle');
        await expect(title).toHaveValue('Authoritative title');
        await expect(title).toBeEnabled();
        await expect(page.getByTestId('document-dirty')).toHaveText('clean');
    });
