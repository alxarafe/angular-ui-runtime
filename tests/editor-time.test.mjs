import test from 'node:test';
import assert from 'node:assert/strict';
import { bindDocumentEditor } from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
import {
    timeInputBounds,
    selectedTime,
} from '../out-tsc/tests/projects/ui-runtime/src/editor/native-time.js';
import { scalarFixture, slots } from './editor-scalar-support.mjs';
const definition = {
    type: 'TIME',
    required: false,
    nullable: true,
    format: 'local-time',
    fractionalDigits: 7,
};

test('TIME retains every exact header/keyed slot and fractional width without projection edits', () => {
    const { project } = scalarFixture(definition);
    for (const [input, invalid] of [
        [{ kind: 'absent' }, false],
        [{ kind: 'value', value: null }, false],
        [{ kind: 'value', value: false }, true],
        ...slots([
            ['', true],
            ['12:30', true],
            ['12:30:00.', true],
            ['24:00:00', true],
            ['12:30:60', true],
            ['12:30:00Z', true],
            [' 12:30:00 ', true],
            ['12:30:00.12345678', true],
            ['00:00:00', false],
            ['23:59:59.9999999', false],
            ...Array.from({ length: 7 }, (_, i) => [
                '12:30:00.' + '1234567'.slice(0, i + 1),
                false,
            ]),
        ]),
    ])
        project(input, invalid);
});

test('TIME precision and exclusive bounds refresh from the plan without changing raw data', () => {
    const f = scalarFixture(definition);
    f.project({ kind: 'raw', text: '12:30:00.1000000' }, false);
    const state = f.session.state;
    for (const fractionalDigits of [0, 1, 6, 7]) {
        f.leaf.definition = {
            ...definition,
            fractionalDigits,
            constraints: { minimum: { value: '12:30:00.1', exclusive: true } },
        };
        const bound = bindDocumentEditor(f.session, f.options);
        assert.equal(bound.contexts.main.invalid, true);
        assert.deepEqual(bound.contexts.main.timeDefinition, f.leaf.definition);
        assert.deepEqual(
            bound.collectionContexts.rows.rows[1].contexts.value.timeDefinition,
            f.leaf.definition,
        );
        assert.equal(f.session.state, state);
    }
});

test('native TIME hints use only admitted whole seconds and exact exclusive endpoints', () => {
    const whole = { ...definition, fractionalDigits: 0 };
    assert.deepEqual(timeInputBounds(whole), { min: '00:00:00', max: '23:59:59' });
    assert.deepEqual(
        timeInputBounds({
            ...whole,
            constraints: {
                minimum: { value: '09:59:59', exclusive: true },
                maximum: { value: '18:00:00', exclusive: true },
            },
        }),
        { min: '10:00:00', max: '17:59:59' },
    );
    for (const def of [
        undefined,
        definition,
        { ...whole, format: 'unknown' },
        { ...whole, constraints: { minimum: { value: '23:59:59', exclusive: true } } },
        { ...whole, constraints: { maximum: { value: '00:00:00', exclusive: true } } },
        { ...whole, constraints: { minimum: { value: '12:30' } } },
    ])
        assert.equal(timeInputBounds(def), undefined);
    assert.equal(selectedTime('12:30'), '12:30:00');
    assert.equal(selectedTime('12:30:15'), '12:30:15');
    for (const text of ['', '12:', '24:00', '12:30:00.1', '12:30:00Z'])
        assert.equal(selectedTime(text), undefined);
});
