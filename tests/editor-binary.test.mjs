import test from 'node:test';
import assert from 'node:assert/strict';
import { bindDocumentEditor } from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
import { scalarFixture, slots } from './editor-scalar-support.mjs';
const definition = { type: 'BINARY', required: false, nullable: true, format: 'base64' };

test('BINARY header/keyed slots preserve canonical Base64 and invalid or unsupported inputs', () => {
    const { project } = scalarFixture(definition);
    for (const [input, invalid] of [
        [{ kind: 'absent' }, false],
        [{ kind: 'value', value: null }, false],
        [{ kind: 'value', value: false }, true],
        ...slots([
            ['', false],
            ['Zg==', false],
            ['Zm8=', false],
            ['Zm9v', false],
            ['Zm9vYmFy', false],
            ['+/8=', false],
            ['Zg', true],
            ['Zg=', true],
            ['Zh==', true],
            ['Zm9=', true],
            ['Zg===', true],
            ['-_8=', true],
            [' Zg== ', true],
            ['Zg==\n', true],
            ['Zg==\r\n', true],
            ['\tZg==', true],
            ['e\u0301', true],
        ]),
    ])
        project(input, invalid);
});

test('BINARY presence policies and unsupported profile diagnostics do not rewrite session inputs', () => {
    for (const required of [false, true])
        for (const nullable of [false, true]) {
            const { project } = scalarFixture({ ...definition, required, nullable });
            for (const [input, invalid] of [
                [{ kind: 'absent' }, required],
                [{ kind: 'value', value: null }, !nullable],
                [{ kind: 'value', value: '' }, false],
                [{ kind: 'raw', text: '' }, false],
            ])
                project(input, invalid);
        }
    const f = scalarFixture(definition);
    f.project({ kind: 'raw', text: 'Zg==\r\n' }, true);
    const state = f.session.state;
    for (const def of [
        { ...definition, required: true, nullable: false },
        { ...definition, format: 'base64url' },
        definition,
    ]) {
        f.leaf.definition = def;
        const bound = bindDocumentEditor(f.session, f.options);
        assert.equal(bound.contexts.main.invalid, true);
        assert.deepEqual(bound.contexts.main.documentInput, { kind: 'raw', text: 'Zg==\r\n' });
        assert.equal(
            bound.validation.state,
            def.format === 'base64url' ? 'definition-error' : 'invalid',
        );
        assert.equal(f.session.state, state);
    }
});
