import { test, expect } from '@playwright/test';

test('document aggregation retains nested row issues and pending checks across edits and themes', async ({
    page,
}) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/default-theme/?scenario=document-validation');
    await expect(
        page.getByRole('heading', { name: 'Document validation aggregation QA' }),
    ).toBeVisible();
    const state = page.getByTestId('document-state');
    const dirty = page.getByTestId('document-dirty');
    const issues = page.getByTestId('document-issue');
    const issuePaths = page.getByTestId('document-issue-path');
    const checks = page.getByTestId('document-check');
    const checkPaths = page.getByTestId('document-check-path');
    const paths = page.getByTestId('document-paths');
    const external = page.getByLabel('External quantity', { exact: true });
    const first = page.getByRole('table', { name: 'First detail rows', exact: true });
    const second = page.getByRole('table', { name: 'Second detail rows', exact: true });
    const firstA = first.getByLabel('Quantity — Row a', { exact: true });
    const secondNew = second.getByLabel('Quantity — Row new-1', { exact: true });

    await expect(state).toHaveText('pending');
    await expect(dirty).toHaveText('clean');
    await expect(issues).toHaveCount(0);
    await expect(checks).toHaveCount(1);
    await expect(checkPaths).toHaveText('serverCode');
    await expect(page.getByTestId('document-diagnostics')).toContainText(
        '0 definition diagnostics',
    );

    await external.fill('1e-');
    await expect(state).toHaveText('invalid');
    await expect(dirty).toHaveText('dirty');
    await expect(issues).toHaveCount(1);
    await expect(issuePaths).toHaveText('external');
    await expect(checks).toHaveCount(1); // The sibling pending obligation is retained.

    await firstA.fill('1e-');
    await expect(issues).toHaveCount(2);
    await expect(issuePaths).toHaveText(['external', 'first / row:a / quantity']);

    await page.getByRole('button', { name: 'Add row to Second detail rows', exact: true }).click();
    await expect(secondNew).toBeVisible();
    await secondNew.fill('x');
    await expect(issues).toHaveCount(3);
    await expect(issuePaths).toHaveText([
        'external',
        'first / row:a / quantity',
        'second / row:new-1 / quantity',
    ]);

    const before = JSON.parse(await paths.textContent());
    await first.getByRole('button', { name: 'Move up Row b', exact: true }).click();
    await expect(
        first.locator('tbody tr').first().getByLabel('Quantity — Row b', { exact: true }),
    ).toBeVisible();
    const after = JSON.parse(await paths.textContent());
    const keys = (list) =>
        list.filter((path) => path[0].name === 'first').map((path) => path[1].key);
    expect(keys(before)).toEqual(['a', 'b']);
    expect(keys(after)).toEqual(['b', 'a']);
    expect(before.map((path) => JSON.stringify(path)).sort()).toEqual(
        after.map((path) => JSON.stringify(path)).sort(),
    );
    await expect(issuePaths).toHaveText([
        'external',
        'first / row:a / quantity',
        'second / row:new-1 / quantity',
    ]);

    const reorderedPaths = await paths.textContent();
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
        await expect(external).toHaveValue('1e-');
        await expect(firstA).toHaveValue('1e-');
        await expect(secondNew).toHaveValue('x');
        await expect(state).toHaveText('invalid');
        await expect(dirty).toHaveText('dirty');
        await expect(issues).toHaveCount(3);
        await expect(checks).toHaveCount(1);
        await expect(paths).toHaveText(reorderedPaths);
    }

    await second.getByRole('button', { name: 'Remove Row new-1', exact: true }).click();
    await expect(secondNew).toHaveCount(0);
    await expect(issues).toHaveCount(2);
    await expect(issuePaths).toHaveText(['external', 'first / row:a / quantity']);

    await first.getByRole('button', { name: 'Move down Row b', exact: true }).click();
    await expect(
        first.locator('tbody tr').first().getByLabel('Quantity — Row a', { exact: true }),
    ).toBeVisible();
    await external.fill('1');
    await firstA.fill('1');
    await expect(issues).toHaveCount(0);
    await expect(state).toHaveText('pending');
    await expect(dirty).toHaveText('clean');
    await expect(checks).toHaveCount(1);
    await expect(checkPaths).toHaveText('serverCode');
    expect(errors).toEqual([]);
});
