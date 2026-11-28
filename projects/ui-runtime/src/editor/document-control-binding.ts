/** SPDX-License-Identifier: Apache-2.0 */
import type { FieldRendererContext } from '../field-types/renderer-context.js';
import type { OptionalControlFormField } from '../form/form-definition.js';
import { resolveFormFieldRenderer } from '../form/form-field-renderer.js';
import { snapshotRequest, OptionalControlUnavailableError } from '../theme/optional-controls.js';
import type { ThemeRegistry, ThemeResolver } from '../theme/theme-runtime.js';

/** Pure projection: a scalar renderer sees only an exact, declared value, never an envelope. */
export function bindDocumentControl(
    field: OptionalControlFormField,
    context: FieldRendererContext,
    registry: ThemeRegistry,
    resolver: ThemeResolver,
) {
    if (context.selector !== undefined)
        throw new Error('Choice selectors do not support optional-control fields');
    if (context.documentInput === undefined) throw new Error('Missing optional document input');
    let resolved: ReturnType<typeof resolveFormFieldRenderer> | undefined;
    try {
        resolved = resolveFormFieldRenderer(field, context, registry, resolver);
    } catch (error) {
        // Invalid requests/identities/semantics still reject. Only representation failure falls back.
        if (!(error instanceof OptionalControlUnavailableError)) throw error;
    }
    const request =
        resolved?.context.control ??
        snapshotRequest(
            context.control ?? {
                domain: registry.controls.find((item) => item.id === field.controlId)!.domain,
            },
        );
    const input = context.documentInput;
    const index = input.kind === 'value' ? request.domain.values.indexOf(input.value) : -1;
    const { documentInput: _input, ...scalar } = { ...context, control: request };
    return {
        request,
        index,
        component: index >= 0 ? resolved?.component : undefined,
        scalarContext:
            index >= 0
                ? { ...scalar, value: input.kind === 'value' ? input.value : scalar.value }
                : undefined,
    };
}
