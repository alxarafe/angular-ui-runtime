import { test, expect } from '@playwright/test';
test('one immutable parent owns header and two keyed collections across edits, reversion and themes', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/default-theme/?scenario=state');
    await expect(page.getByRole('heading', { name: 'Immutable document state QA' })).toBeVisible();
    const dirty = page.getByTestId('state-dirty');
    const title = page.getByLabel('Document title', { exact: true });
    const first = page.getByRole('table', { name: 'First state rows', exact: true });
    const second = page.getByRole('table', { name: 'Second state rows', exact: true });
    const quantity = first.getByLabel('Quantity — Row a', { exact: true });
    const accepted = await page.getByTestId('state-original').textContent();
    await expect(dirty).toHaveText('clean');
    await title.fill('Draft title');
    await quantity.fill('1e-');
    await second.getByLabel('Quantity — Row x', { exact: true }).fill('5');
    await first.getByRole('button', { name: 'Move up Row b', exact: true }).click();
    await second.getByRole('button', { name: 'Move up Row y', exact: true }).click();
    await expect(dirty).toHaveText('dirty');
    await expect(page.getByTestId('state-revision')).toHaveText('5');
    const draft = await page.getByTestId('state-current').textContent();
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
        await expect(title).toHaveValue('Draft title');
        await expect(quantity).toHaveValue('1e-');
        await expect(second.getByLabel('Quantity — Row x', { exact: true })).toHaveValue('5');
        await expect(
            first.locator('tbody tr').first().getByLabel('Quantity — Row b', { exact: true }),
        ).toBeVisible();
        await expect(
            second.locator('tbody tr').first().getByLabel('Quantity — Row y', { exact: true }),
        ).toBeVisible();
        await expect(dirty).toHaveText('dirty');
        await expect(page.getByTestId('state-current')).toHaveText(draft);
        await expect(page.getByTestId('state-original')).toHaveText(accepted);
    }
    await title.fill('Accepted title');
    await quantity.fill('+018446744073709551615'); // Same exact integer; preserve lexical edit.
    await second.getByLabel('Quantity — Row x', { exact: true }).fill('3');
    await first.getByRole('button', { name: 'Move down Row b', exact: true }).click();
    await expect(dirty).toHaveText('dirty'); // Second collection is still reordered.
    await second.getByRole('button', { name: 'Move down Row y', exact: true }).click();
    await expect(dirty).toHaveText('clean');
    await expect(quantity).toHaveValue('+018446744073709551615');
    await page.getByRole('button', { name: 'Add row to First state rows', exact: true }).click();
    await expect(dirty).toHaveText('dirty');
    await first.getByRole('button', { name: 'Remove Row new-1', exact: true }).click();
    await expect(dirty).toHaveText('clean');
    await first.getByRole('button', { name: 'Remove Row a', exact: true }).click();
    await first.getByLabel('Quantity — Row b', { exact: true }).fill('7');
    await expect(page.getByTestId('state-current')).toContainText('"value":"7"');
    const current = JSON.parse(await page.getByTestId('state-current').textContent());
    expect(current.properties.first.rows[0]).toMatchObject({
        key: 'b',
        value: { properties: { quantity: { input: { kind: 'value', value: '7' } } } },
    });
    await expect(page.getByTestId('state-original')).toHaveText(accepted);
    await expect(dirty).toHaveText('dirty');
    expect(Number(await page.getByTestId('state-revision').textContent())).toBeGreaterThan(10);
    expect(errors).toEqual([]);
});
