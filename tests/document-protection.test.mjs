import test from 'node:test';
import assert from 'node:assert/strict';
import { DocumentSession } from '../out-tsc/tests/projects/ui-runtime/src/state/document-session.js';
import { createDocumentState } from '../out-tsc/tests/projects/ui-runtime/src/state/document-state.js';
import {
    NavigationProtection,
    protectBeforeUnload,
} from '../out-tsc/tests/projects/ui-runtime/src/state/navigation-protection.js';
const field = {
    kind: 'field',
    equality: { type: 'exact' },
    input: { kind: 'value', value: 'accepted' },
};
const doc = {
    kind: 'object',
    properties: {
        title: field,
        rows: {
            kind: 'collection',
            ordered: true,
            allowAdd: true,
            allowRemove: true,
            allowReorder: true,
            rows: [
                {
                    key: 'outer',
                    value: {
                        kind: 'object',
                        properties: {
                            nested: {
                                kind: 'collection',
                                ordered: true,
                                allowAdd: true,
                                allowRemove: true,
                                allowReorder: true,
                                rows: [
                                    {
                                        key: 'inner',
                                        value: { kind: 'object', properties: { text: field } },
                                    },
                                ],
                            },
                        },
                    },
                },
            ],
        },
    },
};
const planFor = (node) => {
    if (node.kind === 'field')
        return { kind: 'field', definition: { type: 'STRING', required: true, nullable: false } };
    if (node.kind === 'collection') return { kind: 'collection', row: planFor(node.rows[0].value) };
    return {
        kind: 'object',
        properties: Object.fromEntries(
            Object.entries(node.properties).map(([key, value]) => [key, planFor(value)]),
        ),
    };
};
const plan = planFor(doc);
const session = () => new DocumentSession(createDocumentState(doc));
const edit = (s, text = 'draft') =>
    s.change({
        kind: 'field',
        path: [{ kind: 'property', name: 'title' }],
        input: { kind: 'raw', text },
    });
const deferred = () => {
    let resolve;
    const promise = new Promise((r) => (resolve = r));
    return { promise, resolve };
};
test('clean skips dialog, cancellation preserves full state, confirmation restores nested keys and raw drafts', async () => {
    const s = session();
    const clean = s.state;
    assert.equal(
        await s.requestDiscard('discard', () => {
            throw Error('unexpected');
        }),
        'allowed',
    );
    assert.equal(s.state, clean);
    edit(s, '');
    s.change({
        kind: 'remove-row',
        path: [
            { kind: 'property', name: 'rows' },
            { kind: 'row', key: 'outer' },
            { kind: 'property', name: 'nested' },
        ],
        key: 'inner',
    });
    const before = s.state;
    assert.equal(
        await s.requestDiscard('discard', async (request) => {
            assert(Object.isFrozen(request));
            assert.equal(request.revision, before.revision);
            return false;
        }),
        'cancelled',
    );
    assert.equal(s.state, before);
    assert.equal(await s.requestDiscard('discard', async () => true), 'allowed');
    assert.deepEqual(s.state.current, clean.original);
    assert.equal(s.state.revision, before.revision + 1);
    assert(!s.state.dirty);
});
test('stale edits and save cycles invalidate confirmation; concurrent callers never share permission', async () => {
    const s = session();
    edit(s);
    const d = deferred();
    let calls = 0;
    const nav = new NavigationProtection(s, () => {
        calls++;
        return d.promise;
    });
    const first = nav.requestLeave('route');
    assert.equal(await nav.requestLeave('back'), false);
    assert.equal(await s.requestDiscard('delete', async () => true), 'blocked');
    assert.equal(calls, 1);
    edit(s, 'later');
    const before = s.state;
    d.resolve(true);
    assert.equal(await first, false);
    assert.equal(s.state, before);
    const e = deferred();
    const pending = s.requestDiscard('route', () => e.promise);
    const attempt = s.submit(plan).submission;
    s.resolve(attempt, { kind: 'rejected', reason: 'transport' });
    e.resolve(true);
    assert.equal(await pending, 'stale');
    assert.equal(s.state, before);
});
test('dialog failure releases pending guard without mutation', async () => {
    const s = session();
    edit(s);
    const before = s.state;
    await assert.rejects(
        s.requestDiscard('route', async () => {
            throw Error('dialog');
        }),
    );
    assert.equal(s.state, before);
    assert.equal(await s.requestDiscard('route', async () => false), 'cancelled');
});
for (const outcome of ['saving', 'committed', 'uncertain'])
    test(`${outcome} locks clean and dirty discard/navigation and protects unload`, async () => {
        for (const dirty of [false, true]) {
            const s = session();
            if (dirty) edit(s);
            const before = s.state;
            const attempt = s.submit(plan).submission;
            if (outcome !== 'saving') s.resolve(attempt, { kind: outcome });
            assert(s.requiresProtection);
            assert.equal(
                await s.requestDiscard('discard', () => {
                    throw Error('dialog');
                }),
                'blocked',
            );
            assert.equal(
                await new NavigationProtection(s, async () => true).requestLeave('back'),
                false,
            );
            assert.equal(s.state, before);
        }
    });
test('pending confirmation cannot discard during saving or after authoritative acceptance', async () => {
    for (const accepted of [false, true]) {
        const s = session();
        edit(s);
        const d = deferred();
        const pending = s.requestDiscard('route', () => d.promise);
        const attempt = s.submit(plan).submission;
        if (accepted) s.resolve(attempt, { kind: 'accepted', document: attempt.document });
        const before = s.state;
        d.resolve(true);
        assert.equal(await pending, accepted ? 'stale' : 'blocked');
        assert.equal(s.state, before);
    }
});
test('explicit SSR-safe unload registration follows dirty and clean recovery; cleanup is idempotent', async () => {
    const s = session();
    protectBeforeUnload(s)();
    let handler;
    let adds = 0,
        removes = 0;
    const target = {
        addEventListener(type, fn) {
            assert.equal(type, 'beforeunload');
            handler = fn;
            adds++;
        },
        removeEventListener(type, fn) {
            assert.equal(fn, handler);
            removes++;
        },
    };
    const cleanup = protectBeforeUnload(s, target);
    assert.equal(adds, 0);
    edit(s);
    assert.equal(adds, 1);
    edit(s);
    assert.equal(adds, 1);
    const event = {
        preventDefault() {
            this.prevented = true;
        },
        returnValue: 'unchanged',
    };
    handler(event);
    assert(event.prevented);
    assert.equal(event.returnValue, '');
    await s.requestDiscard('discard', async () => true);
    assert.equal(removes, 1);
    const attempt = s.submit(plan).submission;
    assert.equal(adds, 2);
    s.resolve(attempt, { kind: 'uncertain' });
    assert.equal(removes, 1);
    s.recover(attempt, attempt.document);
    assert.equal(removes, 2);
    edit(s);
    assert.equal(adds, 3);
    cleanup();
    cleanup();
    assert.equal(removes, 3);
    await s.requestDiscard('discard', async () => true);
    edit(s);
    assert.equal(adds, 3);
});

test('discard restores the latest authoritative acceptance, not the constructor snapshot', async () => {
    const s = session();
    edit(s);
    const attempt = s.submit(plan).submission;
    const authoritative = structuredClone(attempt.document);
    authoritative.properties.title.input = { kind: 'value', value: 'normalized accepted' };
    s.resolve(attempt, { kind: 'accepted', document: authoritative });
    const accepted = s.state;
    edit(s, 'later invalid draft');
    await s.requestDiscard('discard', async () => true);
    assert.deepEqual(s.state.current, accepted.original);
    assert.equal(s.state.current.properties.title.input.value, 'normalized accepted');
});
