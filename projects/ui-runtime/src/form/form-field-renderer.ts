/** SPDX-License-Identifier: Apache-2.0 */
import { THEME_ARTIFACTS } from '../theme/theme-definition.js';
import type { ThemeRegistry, ThemeResolver } from '../theme/theme-runtime.js';
import type { FieldRendererContext } from '../field-types/renderer-context.js';
import { snapshotRequest } from '../theme/optional-controls.js';
import type { FormFieldDefinition } from './form-definition.js';

/** Reject ambiguous mechanisms even when an extra property is explicitly undefined. */
export function validateFormFieldRenderer(field: FormFieldDefinition): void {
    if (field.kind === 'control') {
        if (
            Object.hasOwn(field, 'artifact') ||
            typeof field.controlId !== 'string' ||
            !field.controlId.trim()
        )
            throw new Error('Invalid optional form control');
    } else if (
        (field.kind !== undefined && field.kind !== 'artifact') ||
        Object.hasOwn(field, 'controlId') ||
        typeof field.artifact !== 'string' ||
        !field.artifact.startsWith('field.') ||
        !THEME_ARTIFACTS.includes(field.artifact)
    ) {
        throw new Error('Invalid field artifact');
    }
}

/** One reactive binding supplies both selection and the renderer's effective context. */
export function resolveFormFieldRenderer(
    field: FormFieldDefinition,
    context: FieldRendererContext,
    registry: ThemeRegistry,
    resolver: ThemeResolver,
) {
    validateFormFieldRenderer(field);
    if (field.kind !== 'control') return { component: resolver.resolve(field.artifact), context };
    const definition = registry.controls.find((control) => control.id === field.controlId);
    if (!definition) throw new Error('Unknown optional control');
    const request = snapshotRequest(
        context.control === undefined ? { domain: definition.domain } : context.control,
    );
    // Preserve legacy resolveControl(id) admission when an instance request is omitted.
    const resolution = resolver.resolveControl(
        field.controlId,
        context.control === undefined ? undefined : request,
    );
    return { component: resolution.component, context: { ...context, control: request } };
}
