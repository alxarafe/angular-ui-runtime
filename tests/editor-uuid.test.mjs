import test from 'node:test';
import assert from 'node:assert/strict';
import { bindDocumentEditor } from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
import { scalarFixture, slots } from './editor-scalar-support.mjs';
const lower = '123e4567-e89b-12d3-a456-426614174000';
const mixed = '123E4567-e89B-12d3-A456-426614174000';
const definition = { type: 'UUID', required: false, nullable: true, casing: 'either' };

test('UUID lower/either policies retain exact header and keyed raw/value slots without normalization', () => {
    for (const casing of ['lower', 'either']) {
        const { project } = scalarFixture({ ...definition, casing });
        for (const [input, invalid] of [
            [{ kind: 'absent' }, false],
            [{ kind: 'value', value: null }, false],
            [{ kind: 'value', value: false }, true],
            ...slots([
                ['', true],
                ['123e4567-', true],
                ['not-a-uuid', true],
                ['{' + lower + '}', true],
                [lower.replaceAll('-', ''), true],
                [' ' + lower + ' ', true],
                ['123g4567-e89b-12d3-a456-426614174000', true],
                [lower, false],
                [mixed, casing === 'lower'],
                [lower.toUpperCase(), casing === 'lower'],
                ['00000000-0000-0000-0000-000000000000', false],
                ['ffffffff-ffff-ffff-ffff-ffffffffffff', false],
            ]),
        ])
            project(input, invalid);
    }
});

test('UUID casing metadata changes feedback without editing retained lexical data', () => {
    const f = scalarFixture(definition);
    f.project({ kind: 'raw', text: mixed }, false);
    const state = f.session.state;
    for (const casing of ['lower', 'either', 'lower']) {
        f.leaf.definition = { ...definition, casing };
        const bound = bindDocumentEditor(f.session, f.options);
        for (const context of [
            bound.contexts.main,
            bound.collectionContexts.rows.rows[1].contexts.value,
        ]) {
            assert.equal(context.invalid, casing === 'lower');
            assert.deepEqual(context.documentInput, { kind: 'raw', text: mixed });
            assert.equal(context.timeDefinition, undefined);
        }
        assert.equal(f.session.state, state);
    }
});
