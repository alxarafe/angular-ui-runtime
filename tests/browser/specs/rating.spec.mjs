import { test, expect } from '@playwright/test';

const failures = new WeakMap();
test.beforeEach(async ({ page }) => {
    const errors = [];
    failures.set(page, errors);
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    page.on('requestfailed', (request) => errors.push(request.url()));
    page.on('response', (response) => {
        if (response.status() >= 400) errors.push(response.url());
    });
    await page.goto('/?scenario=rating');
});
test.afterEach(async ({ page }) => {
    expect(failures.get(page)).toEqual([]);
});
const field = (page, label) => page.getByLabel(label, { exact: true });
const section = (page, id) => page.getByTestId(`${id}-section`);
const value = (page, id) => page.getByTestId(`${id}-value`);

for (const [id, label, stars, initial, next] of [
    ['quality', 'Quality', 5, '3', '4'],
    ['satisfaction', 'Satisfaction', 5, '7', '8'],
    ['service', 'Service', 10, '9', '10'],
]) {
    test(`${label} resolves its own scale and preserves state and logical focus`, async ({
        page,
    }, info) => {
        const control = field(page, label);
        await expect(control).toHaveValue(initial);
        await expect(section(page, id).locator('.star')).toHaveCount(stars);
        await control.focus();
        await control.press('ArrowRight');
        await expect(value(page, id)).toHaveText(next);
        await control.press('Alt+t');
        await expect(control).toHaveJSProperty('tagName', 'SELECT');
        await expect(control).toBeFocused();
        await expect(control.locator('option:checked')).toHaveText(next);
        await control.selectOption({ label: initial });
        await control.press('Alt+t');
        await expect(control).toHaveJSProperty('tagName', 'INPUT');
        await expect(control).toBeFocused();
        await expect(control).toHaveValue(initial);
        await expect(page.getByTestId(`${id}-state`)).toHaveText(
            'QA dirty: true · Error: Synthetic error retained',
        );
        for (const [other, expected] of [
            ['quality', '3'],
            ['satisfaction', '7'],
            ['service', '9'],
        ])
            await expect(value(page, other)).toHaveText(expected);
        expect(
            await page
                .locator('[id]')
                .evaluateAll(
                    (nodes) => new Set(nodes.map((node) => node.id)).size === nodes.length,
                ),
        ).toBe(true);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
            true,
        );
        await page.screenshot({
            path: `/artifacts/testbed/rating/${info.project.name}-${id}.png`,
            fullPage: true,
        });
    });
}

test('rating exact discrete configuration and noneditable state survive fallback', async ({
    page,
}) => {
    const control = field(page, 'Exact stepped score');
    await expect(control).toHaveValue('-2');
    await control.focus();
    await control.press('ArrowRight');
    await expect(value(page, 'stepped')).toHaveText('0');
    for (const flag of ['Disabled', 'Read only']) {
        await page.getByLabel(`${flag} Exact stepped score`, { exact: true }).check();
        await expect(control).toBeDisabled();
        await control.evaluate((node) => {
            node.value = '2';
            node.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await expect(value(page, 'stepped')).toHaveText('0');
        await expect(page.getByTestId('stepped-events')).toHaveText('1');
        await page.getByRole('button', { name: 'Numeric fallback', exact: true }).click();
        await expect(control).toBeDisabled();
        await control.evaluate((node) => {
            node.value = '0';
            node.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await expect(value(page, 'stepped')).toHaveText('0');
        await expect(page.getByTestId('stepped-events')).toHaveText('1');
        await page.getByLabel(`${flag} Exact stepped score`, { exact: true }).uncheck();
        await page.getByRole('button', { name: 'Stars', exact: true }).click();
    }
    const large = field(page, 'Exact large score');
    await expect(large).toHaveJSProperty('tagName', 'SELECT');
    await large.selectOption({ label: '9223372036854775817' });
    await large.press('Alt+t');
    await expect(large).toBeFocused();
    await expect(value(page, 'large')).toHaveText('9223372036854775817');
    await large.press('Alt+t');
    await expect(value(page, 'large')).toHaveText('9223372036854775817');
});

test('nullable stars emit null from their own keyboard operation; required fields cannot clear', async ({
    page,
}) => {
    const quality = field(page, 'Quality'),
        clear = section(page, 'quality').getByRole('button', { name: 'No rating', exact: true });
    await clear.focus();
    await clear.press('Enter');
    await expect(value(page, 'quality')).toHaveText('null');
    await quality.focus();
    await quality.press('Home');
    // Home can leave the range thumb at zero while the source is null; ArrowRight/Home commits zero.
    await quality.press('ArrowRight');
    await quality.press('Home');
    await expect(value(page, 'quality')).toHaveText('0');
    await clear.click();
    await expect(value(page, 'quality')).toHaveText('null');
    await expect(
        section(page, 'satisfaction').getByRole('button', { name: 'No rating', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Numeric fallback', exact: true }).click();
    await expect(quality.locator('option:checked')).toHaveText('No rating');
    await quality.selectOption({ label: '0' });
    await expect(value(page, 'quality')).toHaveText('0');
    await quality.selectOption({ label: 'No rating' });
    await expect(value(page, 'quality')).toHaveText('null');
    const required = field(page, 'Satisfaction');
    await expect(required.locator('option', { hasText: 'No rating' })).toHaveCount(0);
    await required.evaluate((node) => {
        node.value = '-1';
        node.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect(value(page, 'satisfaction')).toHaveText('7');
    await expect(page.getByTestId('satisfaction-events')).toHaveText('0');
});

test('blocked clear and score operations emit no events in either representation', async ({
    page,
}) => {
    for (const flag of ['Disabled', 'Read only']) {
        await page.getByRole('button', { name: 'Stars', exact: true }).click();
        await page.getByLabel(`${flag} Quality`, { exact: true }).check();
        const clear = section(page, 'quality').getByRole('button', {
            name: 'No rating',
            exact: true,
        });
        await expect(clear).toBeDisabled();
        await clear.evaluate((node) =>
            node.dispatchEvent(new MouseEvent('click', { bubbles: true })),
        );
        await field(page, 'Quality').evaluate((node) => {
            node.value = '5';
            node.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await page.getByRole('button', { name: 'Numeric fallback', exact: true }).click();
        await field(page, 'Quality').evaluate((node) => {
            node.value = '0';
            node.dispatchEvent(new Event('change', { bubbles: true }));
        });
        await expect(value(page, 'quality')).toHaveText('3');
        await expect(page.getByTestId('quality-events')).toHaveText('0');
        await page.getByLabel(`${flag} Quality`, { exact: true }).uncheck();
    }
});

test('pointer edits and incompatible instance fallback do not affect other fields or steal focus', async ({
    page,
}, info) => {
    const quality = field(page, 'Quality');
    await quality.scrollIntoViewIfNeeded();
    const box = await quality.boundingBox();
    if (info.project.name === 'mobile')
        await page.touchscreen.tap(box.x + box.width - 8, box.y + box.height / 2);
    else await page.mouse.click(box.x + box.width - 8, box.y + box.height / 2);
    await expect(value(page, 'quality')).toHaveText('5');
    await expect(value(page, 'satisfaction')).toHaveText('7');
    await expect(value(page, 'service')).toHaveText('9');
    await expect(field(page, 'Three-star configuration')).toHaveJSProperty('tagName', 'SELECT');
    await field(page, 'Three-star configuration').selectOption({ label: '8' });
    await expect(value(page, 'incompatible')).toHaveText('8');
    await expect(quality).toHaveJSProperty('tagName', 'INPUT');
    const themeButton = page.getByRole('button', { name: 'Numeric fallback', exact: true });
    await themeButton.click();
    await expect(themeButton).toBeFocused();
    await expect(value(page, 'quality')).toHaveText('5');
    await expect(value(page, 'satisfaction')).toHaveText('7');
    await expect(value(page, 'service')).toHaveText('9');
    await expect(value(page, 'incompatible')).toHaveText('8');
    await page.getByRole('button', { name: 'Stars', exact: true }).click();
    await expect(field(page, 'Three-star configuration')).toHaveJSProperty('tagName', 'SELECT');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
    );
});
