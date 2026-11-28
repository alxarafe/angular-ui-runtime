import test from 'node:test';
import assert from 'node:assert/strict';
import { Injector } from '@angular/core';
import {
    ThemeRegistry,
    ThemeResolver,
    ThemeService,
    provideThemeRuntime,
    bindDocumentEditor,
} from '../out-tsc/tests/projects/ui-runtime/src/public-api.js';
import { bindDocumentControl } from '../out-tsc/tests/projects/ui-runtime/src/editor/document-control-binding.js';
import { DocumentControl } from '../out-tsc/tests/projects/ui-runtime/src/editor/document-control.js';
import { resolveFormFieldRenderer } from '../out-tsc/tests/projects/ui-runtime/src/form/form-field-renderer.js';
import {
    DEFAULT_THEME,
    FieldProbe,
    OptionalAlternativeProbe,
} from '../out-tsc/tests/tests/fixtures/theme-components.js';
import { scalarFixture } from './editor-scalar-support.mjs';
const domain = {
    semantic: 'qa-optional',
    values: [
        null,
        '',
        true,
        false,
        'false',
        '01',
        ' spaced ',
        'e\u0301',
        'é',
        '9223372036854775807.000000001',
    ],
};
const field = {
    id: 'main',
    kind: 'control',
    controlId: 'optional',
    path: [{ kind: 'property', name: 'main' }],
};
function fixture() {
    const capability = (request) => {
        if (request.presentation?.mode === 'broken')
            throw new Error('No compatible optional control representation');
        return request.presentation?.mode === 'unavailable' ? undefined : request.domain;
    };
    const injector = Injector.create({
        providers: provideThemeRuntime(
            [
                {
                    ...DEFAULT_THEME,
                    controls: {
                        optional: { component: FieldProbe, domain, capabilities: capability },
                    },
                },
                {
                    id: 'active',
                    cssClass: 'active',
                    overrides: {},
                    controls: {
                        alternative: {
                            component: OptionalAlternativeProbe,
                            domain,
                            capabilities: capability,
                        },
                    },
                },
            ],
            [
                { id: 'optional', domain, alternatives: ['alternative'] },
                { id: 'alternative', domain },
            ],
        ),
    });
    return {
        injector,
        registry: injector.get(ThemeRegistry),
        resolver: injector.get(ThemeResolver),
        service: injector.get(ThemeService),
    };
}
const context = (documentInput, control) => ({
    id: 'optional',
    label: 'Optional',
    value: 'legacy projection',
    documentInput,
    ...(control ? { control } : {}),
    invalid: true,
    describedBy: ['help'],
    readOnly: false,
});

test('lossless optional projection mounts scalar controls only for exact declared value slots', () => {
    const f = fixture();
    try {
        for (const input of [
            { kind: 'absent' },
            { kind: 'raw', text: '01' },
            { kind: 'raw', text: 'invalid\npartial' },
            { kind: 'value', value: 'UNKNOWN' },
            ...domain.values.map((value) => ({ kind: 'value', value })),
        ]) {
            const original = context(input),
                before = structuredClone(original);
            const bound = bindDocumentControl(field, original, f.registry, f.resolver);
            const index = input.kind === 'value' ? domain.values.indexOf(input.value) : -1;
            assert.equal(bound.index, index);
            assert.equal(bound.component, index < 0 ? undefined : FieldProbe);
            if (index >= 0) {
                assert.equal(Object.hasOwn(bound.scalarContext, 'documentInput'), false);
                assert.equal(bound.scalarContext.value, input.value);
                assert.deepEqual(bound.scalarContext.describedBy, ['help']);
                assert.equal(bound.scalarContext.invalid, true);
            } else assert.equal(bound.scalarContext, undefined);
            assert.deepEqual(original, before);
        }
    } finally {
        f.injector.destroy();
    }
});

test('optional resolution, presentation and domains refresh without altering session-owned header/keyed input', () => {
    const f = fixture();
    const document = scalarFixture({ type: 'STRING', required: false, nullable: true });
    document.options.definition.fields[0] = field;
    document.options.collections.rows.columns[0] = {
        id: 'value',
        field: 'value',
        label: 'Value',
        kind: 'control',
        controlId: 'optional',
    };
    document.project({ kind: 'raw', text: '01' }, false);
    const state = document.session.state;
    try {
        for (const id of ['default', 'active'])
            for (const mode of ['regular', 'unavailable']) {
                f.service.activate(id);
                const request = { domain, presentation: { mode } };
                document.options.fields.main.control = request;
                document.options.collections.rows.fields = { value: { control: request } };
                const projection = bindDocumentEditor(document.session, document.options);
                for (const original of [
                    projection.contexts.main,
                    projection.collectionContexts.rows.rows[1].contexts.value,
                ]) {
                    const bound = bindDocumentControl(field, original, f.registry, f.resolver);
                    assert.equal(bound.component, undefined);
                    assert.equal(bound.index, -1);
                    assert.deepEqual(bound.request, request);
                    const known = bindDocumentControl(
                        field,
                        { ...original, documentInput: { kind: 'value', value: '01' } },
                        f.registry,
                        f.resolver,
                    );
                    assert.equal(
                        known.component,
                        mode === 'unavailable'
                            ? undefined
                            : id === 'active'
                              ? OptionalAlternativeProbe
                              : FieldProbe,
                    );
                }
                assert.equal(document.session.state, state);
            }
        const subset = { domain: { ...domain, values: [false, 'false'] } };
        assert.equal(
            bindDocumentControl(
                field,
                context({ kind: 'value', value: '01' }, subset),
                f.registry,
                f.resolver,
            ).component,
            undefined,
        );
        assert.throws(
            () =>
                resolveFormFieldRenderer(
                    field,
                    context(
                        { kind: 'value', value: '01' },
                        { domain, presentation: { mode: 'unavailable' } },
                    ),
                    f.registry,
                    f.resolver,
                ),
            /No compatible/,
        );
        for (const bad of [
            { domain: { ...domain, semantic: 'wrong' } },
            { domain: { ...domain, values: [] } },
        ])
            assert.throws(() =>
                bindDocumentControl(
                    field,
                    context({ kind: 'absent' }, bad),
                    f.registry,
                    f.resolver,
                ),
            );
        assert.throws(
            () =>
                bindDocumentControl(
                    { ...field, controlId: 'missing' },
                    context({ kind: 'absent' }),
                    f.registry,
                    f.resolver,
                ),
            /Unknown optional/,
        );
        assert.throws(
            () =>
                bindDocumentControl(
                    field,
                    { ...context({ kind: 'absent' }), selector: {} },
                    f.registry,
                    f.resolver,
                ),
            /Choice selectors/,
        );
        assert.throws(
            () =>
                bindDocumentControl(
                    field,
                    context(
                        { kind: 'absent' },
                        {
                            domain,
                            presentation: { mode: 'broken' },
                        },
                    ),
                    f.registry,
                    f.resolver,
                ),
            /No compatible optional control representation/,
        );
    } finally {
        f.injector.destroy();
    }
});

test('optional adapter forwards one exact value event, rejects stale/out-of-domain/blocked outputs and ignores placeholder events', () => {
    const emitted = [];
    let blocked = false;
    let binding = { component: FieldProbe, scalarContext: {}, request: { domain }, index: -1 };
    const adapter = {
        context: () => ({ readOnly: blocked }),
        binding: () => binding,
        editChange: { emit: (input) => emitted.push(input) },
        edit: DocumentControl.prototype.edit,
    };
    for (const value of domain.values)
        DocumentControl.prototype.select.call(adapter, value, FieldProbe);
    assert.deepEqual(
        emitted,
        domain.values.map((value) => ({ kind: 'value', value })),
    );
    DocumentControl.prototype.select.call(adapter, 'outside', FieldProbe);
    DocumentControl.prototype.select.call(adapter, '01', OptionalAlternativeProbe);
    blocked = true;
    DocumentControl.prototype.select.call(adapter, '01', FieldProbe);
    adapter.context = () => ({ disabled: true });
    DocumentControl.prototype.select.call(adapter, '01', FieldProbe);
    adapter.context = () => ({ readOnly: blocked });
    assert.equal(emitted.length, domain.values.length);
    blocked = false;
    binding = { ...binding, component: undefined, scalarContext: undefined };
    for (const value of ['', '-1', '01', '1.0', '99']) {
        const control = { value };
        DocumentControl.prototype.choose.call(adapter, { target: control });
        assert.equal(control.value, '');
    }
    assert.equal(emitted.length, domain.values.length);
    DocumentControl.prototype.choose.call(adapter, { target: { value: '3' } });
    assert.deepEqual(emitted.at(-1), { kind: 'value', value: false });
    blocked = true;
    DocumentControl.prototype.choose.call(adapter, { target: { value: '4' } });
    assert.equal(emitted.length, domain.values.length + 1);
});
