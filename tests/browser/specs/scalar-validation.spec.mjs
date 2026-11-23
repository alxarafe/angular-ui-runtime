import { test, expect } from '@playwright/test';
test('scalar validation uses public fields, explicit raw adapters and exact slots across themes', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/default-theme/?scenario=validation');
    const result = (id) => page.getByTestId('scalar-result-' + id);
    const stored = (id) => page.getByTestId('scalar-input-' + id);
    const feedback = (id) => page.locator('#' + id + '-feedback');
    const title = page.getByLabel('Unicode title', { exact: true });
    const notes = page.getByLabel('Unicode notes', { exact: true });
    const flag = page.getByLabel('Boolean flag', { exact: true });
    const choice = page.getByLabel('Exact choice', { exact: true });
    const binary = page.getByLabel('Base64 draft (text adapter)', { exact: true });
    const dirty = page.getByTestId('validation-dirty');
    await expect(dirty).toHaveText('clean');
    for (const id of ['title', 'notes', 'flag', 'choice', 'binary']) {
        await expect(result(id)).toHaveText('valid');
        await expect(page.locator(`aur-form-field[data-aur-field="${id}"]`)).toHaveAttribute(
            'aria-describedby',
            id + '-feedback',
        );
    }
    await expect(title).toHaveValue(' A😀 ');
    await expect(stored('choice')).toHaveText(JSON.stringify({ kind: 'value', value: '' }));
    await title.fill('');
    await expect(feedback('title')).toContainText('minimum length');
    const multiline = '  😀\ne\u0301  ';
    await notes.fill(multiline);
    await expect(result('notes')).toHaveText('valid'); // Eight Unicode scalars.
    await page.getByRole('button', { name: 'Edit raw BOOLEAN', exact: true }).click();
    await expect(flag).toHaveValue('true');
    await flag.fill('false');
    await expect(result('flag')).toHaveText('invalid');
    await expect(stored('flag')).toHaveText(JSON.stringify({ kind: 'raw', text: 'false' }));
    await choice.selectOption({ label: 'Not set' });
    await expect(stored('choice')).toHaveText(JSON.stringify({ kind: 'value', value: null }));
    await expect(feedback('choice')).toHaveText('Explicit null is not allowed.');
    await binary.fill('Zh=='); // Same decoded byte as Zg==, but noncanonical pad bits.
    await expect(feedback('binary')).toContainText('canonical standard Base64');
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
        await expect(title).toHaveValue('');
        await expect(notes).toHaveValue(multiline);
        await expect(flag).toHaveValue('false');
        await expect(binary).toHaveValue('Zh==');
        await expect(stored('choice')).toHaveText(JSON.stringify({ kind: 'value', value: null }));
        for (const field of ['title', 'flag', 'choice', 'binary']) {
            await expect(result(field)).toHaveText('invalid');
            await expect(feedback(field)).toBeVisible();
            await expect(page.locator(`aur-form-field[data-aur-field="${field}"]`)).toHaveAttribute(
                'aria-describedby',
                field + '-feedback',
            );
        }
        await expect(dirty).toHaveText('dirty');
    }
    await title.fill(' A😀 ');
    await notes.fill('e\u0301\n😀');
    await page.getByRole('button', { name: 'Use boolean true', exact: true }).click();
    await expect(stored('flag')).toHaveText(JSON.stringify({ kind: 'value', value: true }));
    await expect(result('flag')).toHaveText('valid');
    await expect(flag).toHaveAttribute('type', 'checkbox');
    await flag.uncheck();
    await expect(stored('flag')).toHaveText(JSON.stringify({ kind: 'value', value: false }));
    await choice.selectOption({ label: '(empty string)' });
    await expect(stored('choice')).toHaveText(JSON.stringify({ kind: 'value', value: '' }));
    await expect(result('choice')).toHaveText('valid');
    await binary.fill('Zm8=');
    await expect(result('binary')).toHaveText('valid');
    await expect(dirty).toHaveText('dirty'); // Valid does not mean unchanged.
    await binary.fill('Zg==');
    await expect(dirty).toHaveText('clean');
    await title.fill('é');
    await expect(result('title')).toHaveText('valid');
    await expect(title).toHaveValue('é');
    await title.fill('e\u0301');
    await expect(result('title')).toHaveText('valid');
    await expect(title).toHaveValue('e\u0301');
    await expect(dirty).toHaveText('dirty');
    expect(errors).toEqual([]);
});
