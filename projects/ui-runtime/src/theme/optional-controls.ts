/** SPDX-License-Identifier: Apache-2.0 */
import { Type } from '@angular/core';
import { FieldRenderer, FieldValue } from '../field-types/renderer-context.js';

/** A bounded, explicit domain. Tokens identify semantics, not primitive types. */
export interface ControlDomain {
    readonly semantic: string;
    readonly values: readonly FieldValue[];
}
/** Instance-owned options; exact data belongs in domain.values, never number options. */
export type ControlPresentation = Readonly<Record<string, string | number | boolean>>;
export interface ControlRequest {
    readonly domain: ControlDomain;
    readonly presentation?: ControlPresentation;
}
export interface OptionalControlDefinition {
    readonly id: string;
    readonly domain: ControlDomain;
    readonly alternatives?: readonly string[];
}
export interface OptionalControlRenderer {
    readonly component: Type<FieldRenderer>;
    /** Every value this representation can express without coercion. */
    readonly domain: ControlDomain;
    /** Dynamic capability for this exact request, or undefined when incompatible.
     * Required when presentation options are supplied; static domains cannot ignore them.
     */
    readonly capabilities?: (request: ControlRequest) => ControlDomain | undefined;
}
export interface ControlResolution {
    readonly component: Type<FieldRenderer>;
    readonly control: string;
    readonly theme: string;
}
/** Internal distinction between unavailable presentation and malformed requests/capabilities. */
export class OptionalControlUnavailableError extends Error {
    constructor() {
        super('No compatible optional control representation');
    }
}

export function snapshotDomain(domain: ControlDomain): ControlDomain {
    if (
        !domain ||
        typeof domain.semantic !== 'string' ||
        !domain.semantic.trim() ||
        !Array.isArray(domain.values) ||
        !domain.values.length ||
        domain.values.some(
            (value) => value !== null && typeof value !== 'string' && typeof value !== 'boolean',
        ) ||
        new Set(domain.values).size !== domain.values.length
    )
        throw new Error('Invalid control domain');
    return Object.freeze({ semantic: domain.semantic, values: Object.freeze([...domain.values]) });
}
export function covers(capability: ControlDomain, requested: ControlDomain): boolean {
    return (
        capability.semantic === requested.semantic &&
        requested.values.every((value) => capability.values.includes(value))
    );
}

export function snapshotRequest(request: ControlRequest): ControlRequest {
    if (!request || typeof request !== 'object') throw new Error('Invalid control request');
    const presentation = request.presentation;
    if (
        presentation !== undefined &&
        (!presentation ||
            Array.isArray(presentation) ||
            typeof presentation !== 'object' ||
            Object.values(presentation).some(
                (value) =>
                    !['string', 'boolean', 'number'].includes(typeof value) ||
                    (typeof value === 'number' && !Number.isFinite(value)),
            ))
    )
        throw new Error('Invalid control presentation');
    return Object.freeze({
        domain: snapshotDomain(request.domain),
        ...(presentation === undefined ? {} : { presentation: Object.freeze({ ...presentation }) }),
    });
}
