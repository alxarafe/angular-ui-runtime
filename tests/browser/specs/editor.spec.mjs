import { test, expect } from '@playwright/test';
const snapshot = async (page) =>
    JSON.parse(await page.getByTestId('editor-snapshot').textContent());
const summary = (page) => page.getByRole('region', { name: 'Document feedback', exact: true });
async function correct(page) {
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Draft title');
    await page
        .getByRole('textbox', { name: 'Exact count', exact: true })
        .fill('18446744073709551615');
    await summary(page)
        .getByRole('button', { name: /local: amount/ })
        .first()
        .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Numbers', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await expect(page.getByRole('button', { name: 'Amount section', exact: true })).toHaveAttribute(
        'aria-expanded',
        'true',
    );
    const amount = page.getByRole('textbox', { name: 'Exact amount', exact: true });
    await expect(amount).toBeFocused();
    await expect(amount).toHaveAttribute('aria-invalid', 'true');
    expect(
        await amount.evaluate((el) =>
            el
                .getAttribute('aria-describedby')
                .split(' ')
                .every((id) => !!document.getElementById(id)),
        ),
    ).toBe(true);
    await amount.fill('12345678901234567890.123456789');
    await summary(page)
        .getByRole('button', { name: /local: details.*nested.*quantity/ })
        .first()
        .focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('tab', { name: 'Details', exact: true })).toHaveAttribute(
        'aria-selected',
        'true',
    );
    await expect(page.getByRole('button', { name: 'First section', exact: true })).toHaveAttribute(
        'aria-expanded',
        'true',
    );
    const nested = page.getByRole('textbox', { name: 'Nested quantity — Row n', exact: true });
    await expect(nested).toBeFocused();
    await expect(nested).toHaveValue('bad');
    await nested.fill('1e-');
    await expect(page.getByTestId('editor-validity')).toHaveText('invalid');
    await nested.fill('9007199254740993');
    await expect(page.getByTestId('editor-validity')).toHaveText('pending');
}
test('lossless input distinguishes missing, null, empty text, boolean and invalid raw without coercion', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/default-theme/?scenario=editor');
    await expect
        .poll(async () => (await snapshot(page)).properties.optional.input)
        .toEqual({ kind: 'absent' });
    expect((await snapshot(page)).properties.nullable.input).toEqual({
        kind: 'value',
        value: null,
    });
    await page.getByRole('button', { name: 'Set null Optional text', exact: true }).click();
    await expect
        .poll(async () => (await snapshot(page)).properties.optional.input)
        .toEqual({
            kind: 'value',
            value: null,
        });
    await page.getByRole('button', { name: 'Set empty text Optional text', exact: true }).click();
    await expect
        .poll(async () => (await snapshot(page)).properties.optional.input)
        .toEqual({ kind: 'value', value: '' });
    const optional = page.getByRole('textbox', { name: 'Optional text', exact: true });
    await optional.fill('-');
    await expect
        .poll(async () => (await snapshot(page)).properties.optional.input)
        .toEqual({ kind: 'raw', text: '-' });
    await optional.fill('');
    await expect
        .poll(async () => (await snapshot(page)).properties.optional.input)
        .toEqual({ kind: 'raw', text: '' });
    await page.getByRole('button', { name: 'Unset Optional text', exact: true }).click();
    await expect
        .poll(async () => (await snapshot(page)).properties.optional.input)
        .toEqual({ kind: 'absent' });
    await page.getByRole('checkbox', { name: 'Enabled', exact: true }).uncheck();
    await expect
        .poll(async () => (await snapshot(page)).properties.flag.input)
        .toEqual({ kind: 'value', value: false });
    await expect(page.getByRole('textbox', { name: 'Read only', exact: true })).toHaveAttribute(
        'readonly',
        '',
    );
    await expect(page.getByRole('textbox', { name: 'Disabled', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('editor-message')).toHaveText('blocked');
    await expect(page.getByTestId('editor-save')).toHaveText('idle');
    expect((await snapshot(page)).properties.amount.input.value).toBe('1e-');
    expect(errors).toEqual([]);
});
test('hidden errors reveal keyed nested cells, exact edits survive themes, and save/discard reuse the session', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/default-theme/?scenario=editor');
    await correct(page);
    await page.getByRole('button', { name: 'Add row to First details', exact: true }).click();
    await page
        .getByRole('textbox', { name: 'First quantity — Row new-1', exact: true })
        .fill('18446744073709551615');
    await page.getByRole('button', { name: 'Move down Row a', exact: true }).click();
    await page.getByRole('button', { name: 'Remove Row new-1', exact: true }).click();
    await expect
        .poll(async () =>
            (await snapshot(page)).properties.details.properties.first.rows.map((row) => row.key),
        )
        .toEqual(['b', 'a']);
    await page.getByRole('button', { name: 'Second section', exact: true }).click();
    await page.getByRole('button', { name: 'Add row to Second details', exact: true }).click();
    await page.getByRole('button', { name: 'Remove Row new-2', exact: true }).click();
    await expect(
        page.getByRole('textbox', { name: 'Second quantity — Row new-2', exact: true }),
    ).toHaveCount(0);
    const before = await snapshot(page);
    for (const theme of [
        'default',
        'alternative',
        'cyberpunk',
        'vintage',
        'high-contrast',
        'grid-frame',
    ]) {
        await page.getByRole('button', { name: theme, exact: true }).click();
        expect(await snapshot(page)).toEqual(before);
        await expect(
            page.getByRole('textbox', { name: 'Nested quantity — Row n', exact: true }),
        ).toHaveValue('9007199254740993');
    }
    await page.getByRole('tab', { name: 'Header', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByTestId('editor-save')).toHaveText('saving');
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Reject conflict', exact: true }).click();
    await expect(page.getByTestId('editor-save')).toHaveText('idle');
    expect(await snapshot(page)).toEqual(before);
    await expect(summary(page)).toContainText('server: Document');
    await expect(summary(page)).toContainText('Synthetic row rejection');
    await summary(page)
        .getByRole('button', { name: /server: details.*nested \/ n —/ })
        .first()
        .click();
    const nested = page.getByRole('textbox', { name: 'Nested quantity — Row n', exact: true });
    await expect(nested).toBeFocused();
    const described = await nested.getAttribute('aria-describedby');
    expect(described).toContain('aur-row-message-');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await page.getByRole('button', { name: 'Committed', exact: true }).click();
    await expect(page.getByTestId('editor-save')).toHaveText('reconciling');
    await expect(nested).toBeDisabled();
    await page.getByRole('button', { name: 'Accept authoritative', exact: true }).click();
    await expect(page.getByTestId('editor-dirty')).toHaveText('false');
    await expect(page.getByTestId('editor-save')).toHaveText('idle');
    const accepted = await snapshot(page);
    expect(accepted.properties.details.properties.first.rows.map((row) => row.key)).toEqual([
        'b',
        'a',
    ]);
    expect(accepted.properties.count.input.value).toBe('18446744073709551615');
    expect(accepted.properties.amount.input.value).toBe('12.3400');
    await page.getByRole('tab', { name: 'Header', exact: true }).click();
    await page.getByRole('textbox', { name: 'Title', exact: true }).fill('Later draft');
    await expect
        .poll(async () => (await snapshot(page)).properties.title.input)
        .toEqual({ kind: 'raw', text: 'Later draft' });
    const draft = await snapshot(page);
    const discard = page.getByRole('button', { name: 'Discard', exact: true });
    await discard.click();
    await page.getByRole('button', { name: 'Cancel discard', exact: true }).click();
    expect(await snapshot(page)).toEqual(draft);
    await expect(discard).toBeFocused();
    await discard.click();
    await page.getByRole('button', { name: 'Confirm discard', exact: true }).click();
    await expect(page.getByTestId('editor-dirty')).toHaveText('false');
    expect(await snapshot(page)).toEqual(accepted);
    expect(errors).toEqual([]);
});
