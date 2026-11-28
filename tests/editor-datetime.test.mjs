import test from 'node:test';
import assert from 'node:assert/strict';
import { bindDocumentEditor } from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
import { scalarFixture, slots } from './editor-scalar-support.mjs';
const definition = {
    type: 'DATETIME',
    required: false,
    nullable: true,
    format: 'offset-instant',
    fractionalDigits: 7,
};

test('DATETIME header and keyed slots retain offset spelling, precision and invalid drafts', () => {
    const { project } = scalarFixture(definition);
    for (const [input, invalid] of [
        [{ kind: 'absent' }, false],
        [{ kind: 'value', value: null }, false],
        [{ kind: 'value', value: false }, true],
        ...slots([
            ['', true],
            ['2024-03-01T12:', true],
            ['2024-03-01T12:30:00.1234567+', true],
            ['2024-03-01T12:30:00', true],
            ['2024-03-01T12:30:00z', true],
            ['2024-03-01T12:30:00+14:01', true],
            ['2024-03-01T12:30:00.12345678Z', true],
            [' 2024-03-01T12:30:00Z ', true],
            ['0001-01-01T00:00:00+00:01', true],
            ...['Z', '+00:00', '-00:00', '+05:45', '-03:30', '+14:00', '-14:00'].map((offset) => [
                '2024-03-01T12:30:00' + offset,
                false,
            ]),
            ...Array.from({ length: 7 }, (_, i) => [
                '2024-03-01T12:30:00.' + '1234567'.slice(0, i + 1) + '+01:00',
                false,
            ]),
            ['2024-03-01T12:30:00.1000000Z', false],
        ]),
    ])
        project(input, invalid);
});

test('DATETIME exact instant bounds and metadata never normalize offset or fractional spelling', () => {
    const f = scalarFixture({
        ...definition,
        constraints: {
            minimum: { value: '2024-03-01T12:30:00.1234567Z', exclusive: true },
            maximum: { value: '2024-03-01T12:30:00.1234569Z', exclusive: true },
        },
    });
    for (const [text, invalid] of [
        ['2024-03-01T13:30:00.1234567+01:00', true],
        ['2024-03-01T09:00:00.1234568-03:30', false],
        ['2024-03-01T18:15:00.1234569+05:45', true],
    ])
        f.project({ kind: 'raw', text }, invalid);
    const state = f.session.state;
    for (const fractionalDigits of [0, 3, 7]) {
        f.leaf.definition = { ...definition, fractionalDigits };
        const bound = bindDocumentEditor(f.session, f.options);
        assert.equal(bound.contexts.main.invalid, fractionalDigits < 7);
        assert.equal(bound.contexts.main.timeDefinition, undefined);
        assert.equal(bound.contexts.main.dateConstraints, undefined);
        assert.equal(f.session.state, state);
    }
});
