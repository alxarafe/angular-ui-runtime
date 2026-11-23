/** SPDX-License-Identifier: Apache-2.0 */
import { Component, input } from '@angular/core';
import type {
    FormDefinition,
    FormLayout,
    FormPresentation,
    FormPresentationContext,
    ValuePath,
} from '../../projects/ui-runtime/src/public-api.js';
import type {
    FormLayout as ProposedLayout,
    ValuePath as ProposedPath,
} from '../../docs/design/ui-runtime-v1.types.js';
@Component({ template: '<ng-content />' })
export class DefaultFrame implements FormPresentation {
    readonly context = input.required<FormPresentationContext>();
}
@Component({ template: '<aside><ng-content /></aside>' })
export class AlternateFrame implements FormPresentation {
    readonly context = input.required<FormPresentationContext>();
}
@Component({ template: '<ng-content select=".private" />' })
export class InvalidFrame implements FormPresentation {
    readonly context = input.required<FormPresentationContext>();
}
function compatibility(layout: ProposedLayout, path: ProposedPath): void {
    const publishedLayout: FormLayout = layout;
    const publishedPath: ValuePath = path;
    // @ts-expect-error Path segments cannot use unstable row indexes.
    const unstable: ValuePath = [{ kind: 'row', index: 0 }];
    // @ts-expect-error Form definitions never own HTTP or persistence callbacks.
    const transport: FormDefinition = { id: 'a', label: 'A', fields: [], saveUrl: '/api' };
    void [publishedLayout, publishedPath, unstable, transport];
}
void compatibility;

import type { FormField, FormFieldDefinition } from '../../projects/ui-runtime/src/public-api.js';
interface ExtendedLegacyField extends FormField {
    readonly applicationHint?: string;
}
function rendererCompatibility(path: ValuePath): void {
    const legacy: ExtendedLegacyField = { id: 'legacy', path, artifact: 'field.STRING' };
    const optional: FormFieldDefinition = {
        id: 'optional',
        path,
        kind: 'control',
        controlId: 'rating',
    };
    const fields: readonly FormFieldDefinition[] = [legacy, optional];
    const ambiguous: FormFieldDefinition = {
        id: 'bad',
        path,
        kind: 'control',
        controlId: 'rating',
        // @ts-expect-error An optional control cannot also select a base artifact.
        artifact: 'field.STRING',
    };
    // @ts-expect-error A control ID requires the control discriminant.
    const undiscriminated: FormFieldDefinition = { id: 'bad', path, controlId: 'rating' };
    // @ts-expect-error The legacy branch cannot contain a control ID.
    const mixedLegacy: FormFieldDefinition = {
        id: 'bad',
        path,
        artifact: 'field.STRING',
        controlId: 'rating',
    };
    void [fields, ambiguous, undiscriminated, mixedLegacy];
}
void rendererCompatibility;
