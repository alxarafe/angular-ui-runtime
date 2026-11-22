import { Type } from '@angular/core';
import { FieldRenderer, FieldValue } from '../field-types/renderer-context.js';

/** A bounded, explicit domain. Tokens identify semantics, not primitive types. */
export interface ControlDomain {
  readonly semantic: string;
  readonly values: readonly FieldValue[];
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
}
export interface ControlResolution {
  readonly component: Type<FieldRenderer>;
  readonly control: string;
  readonly theme: string;
}

export function snapshotDomain(domain: ControlDomain): ControlDomain {
  if (!domain || typeof domain.semantic !== 'string' || !domain.semantic.trim() ||
      !Array.isArray(domain.values) || !domain.values.length ||
      domain.values.some(value => value !== null && typeof value !== 'string' && typeof value !== 'boolean') ||
      new Set(domain.values).size !== domain.values.length)
    throw new Error('Invalid control domain');
  return Object.freeze({ semantic: domain.semantic, values: Object.freeze([...domain.values]) });
}
export function covers(capability: ControlDomain, requested: ControlDomain): boolean {
  return capability.semantic === requested.semantic && requested.values.every(value => capability.values.includes(value));
}
