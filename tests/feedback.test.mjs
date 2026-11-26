import test from 'node:test';
import assert from 'node:assert/strict';
import { ElementRef, Injector, runInInjectionContext, signal } from '@angular/core';
import { FeedbackSummary } from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
const p = (name) => [{ kind: 'property', name }];
const item = (source, path, message = 'Feedback') => ({ source, path, message });
function fixture(feedback, reveal) {
    const document = { body: {}, activeElement: {} };
    const root = {
        ownerDocument: document,
        focus() {
            document.activeElement = this;
        },
    };
    const injector = Injector.create({
        providers: [{ provide: ElementRef, useValue: { nativeElement: root } }],
    });
    const summary = runInInjectionContext(injector, () => new FeedbackSummary());
    summary.feedback = signal(feedback);
    summary.reveal = signal(reveal);
    return { summary, document, root, close: () => injector.destroy() };
}
test('feedback preserves simultaneous messages and sources, separates deferred checks, and never infers path labels', () => {
    const feedback = [
        item('server', [], 'Root'),
        item('local', p('private'), 'One'),
        item('local', p('private'), 'Two'),
        item('definition', p('missing')),
        item('deferred', p('pending')),
    ];
    const f = fixture(feedback);
    try {
        assert.equal(f.summary.errors().length, 4);
        assert.equal(f.summary.deferred().length, 1);
        assert.equal(f.summary.text(feedback[0]), 'server: Document — Root');
        assert.equal(f.summary.text(feedback[1]), 'local: One');
        assert.equal(f.summary.feedback(), feedback);
    } finally {
        f.close();
    }
});
test('first-invalid skips root, deferred, unknown, disabled and repeated paths, stopping at first actual focus', async () => {
    const feedback = [
        item('server', []),
        item('deferred', p('pending')),
        item('local', p('missing')),
        item('local', [{ name: 'missing', kind: 'property' }]),
        item('local', p('disabled')),
        item('server', p('good')),
        item('local', p('later')),
    ];
    const calls = [];
    const f = fixture(feedback, async (path) => {
        calls.push(path);
        return path[0].name === 'good';
    });
    try {
        assert.equal(await f.summary.focusFirstInvalid(), true);
        assert.deepEqual(calls, [p('missing'), p('disabled'), p('good')]);
        assert.equal(f.summary.status(), '');
        assert.equal(f.summary.feedback(), feedback);
    } finally {
        f.close();
    }
});
test('failed/throwing navigation preserves origin focus and provides an accessible result; return focus is explicit', async () => {
    const feedback = [item('local', p('missing'))];
    const f = fixture(feedback, () => false),
        origin = f.document.activeElement;
    try {
        assert.equal(await f.summary.focusFeedback(feedback[0]), false);
        assert.equal(f.document.activeElement, origin);
        assert.match(f.summary.status(), /No focusable target/);
        f.summary.reveal.set(() => {
            throw new Error('Application failure');
        });
        assert.equal(await f.summary.focusFirstInvalid(), false);
        assert.equal(f.summary.status(), 'Feedback could not be revealed.');
        f.summary.feedback.set([...feedback]);
        assert.equal(f.summary.status(), '');
        assert.equal(f.summary.focus(), true);
        assert.equal(f.document.activeElement, f.root);
    } finally {
        f.close();
    }
});
test('pending navigation suppresses duplicate actions and stops if the owner, feedback or focus changes', async () => {
    for (const change of ['focus', 'feedback', 'destroy']) {
        const feedback = [item('local', p('first')), item('local', p('next'))];
        let resolve;
        const calls = [];
        const f = fixture(feedback, (path) => {
            calls.push(path);
            return new Promise((done) => (resolve = done));
        });
        const pending = f.summary.focusFirstInvalid();
        assert.equal(await f.summary.focusFirstInvalid(), false);
        if (change === 'focus') f.document.activeElement = {};
        if (change === 'feedback') f.summary.feedback.set([...feedback]);
        if (change === 'destroy') f.close();
        resolve(false);
        assert.equal(await pending, false);
        assert.equal(calls.length, 1);
        if (change !== 'destroy') {
            assert.equal(f.summary.busy(), false);
            f.close();
        }
    }
});

test('grid reveal reports real focus and row reveal skips disabled cells without positional identity', async () => {
    const { DetailGrid, ThemeService } =
        await import('../out-tsc/tests/projects/ui-runtime/src/public-api.js');
    const document = { body: {}, activeElement: {} };
    const make = (column, disabled = false) => ({
        id: 'aur-cell-' + encodeURIComponent(JSON.stringify(['rows', 'opaque /?#', column])),
        ownerDocument: document,
        focus() {
            if (!disabled) document.activeElement = this;
        },
    });
    const disabled = make('disabled', true),
        editable = make('editable'),
        scroll = {
            ownerDocument: document,
            focus() {
                document.activeElement = this;
            },
        };
    const root = { querySelector: () => scroll, querySelectorAll: () => [disabled, editable] };
    const injector = Injector.create({
        providers: [
            { provide: ElementRef, useValue: { nativeElement: root } },
            { provide: ThemeService, useValue: { current: () => ({ cssClass: 'default' }) } },
        ],
    });
    const grid = runInInjectionContext(injector, () => new DetailGrid());
    grid.context = signal({
        id: 'rows',
        label: 'Rows',
        path: p('rows'),
        ordered: false,
        readOnly: false,
        allowAdd: false,
        allowRemove: false,
        allowReorder: false,
        columns: [
            { id: 'disabled', field: 'disabled', label: 'Disabled', artifact: 'field.STRING' },
            { id: 'editable', field: 'editable', label: 'Editable', artifact: 'field.STRING' },
        ],
        rows: [{ key: 'opaque /?#', label: 'Row', values: { disabled: '', editable: '' } }],
    });
    const row = [...p('rows'), { kind: 'row', key: 'opaque /?#' }];
    try {
        const origin = document.activeElement;
        assert.equal(grid.revealPath([...row, { kind: 'property', name: 'disabled' }]), false);
        assert.equal(document.activeElement, origin);
        assert.equal(grid.revealPath(row), true);
        assert.equal(document.activeElement, editable);
        assert.equal(grid.revealPath([...p('rows'), { kind: 'row', key: 'removed' }]), false);
        assert.equal(grid.revealPath([...row, { kind: 'property', name: 'missing' }]), false);
        assert.equal(grid.revealPath(p('rows')), true);
        assert.equal(document.activeElement, scroll);
    } finally {
        injector.destroy();
    }
});
