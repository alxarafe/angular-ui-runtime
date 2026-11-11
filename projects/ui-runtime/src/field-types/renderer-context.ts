/**
 * SPDX-License-Identifier: Apache-2.0
 * Extracted from alxarafe/erbas-client: app/src/app/core-fe/field-types/renderer-context.ts
 * Source revision: cb7ca1682cdb8c6b253cf038e9daaf1898e02107
 * Modified for the reusable package; see NOTICE for provenance and changes.
 */
import { InputSignal, OutputEmitterRef } from '@angular/core';

// Exact numbers, dates, instants and binary values stay strings here. Transport and
// semantic validation belong to consumer applications, not to theme widgets.
export type FieldValue = string | boolean | null;
export interface FieldRendererContext {
  readonly id: string;
  readonly label: string;
  readonly value: FieldValue;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly choices?: readonly string[];
}
export interface FieldRenderer {
  readonly context: InputSignal<FieldRendererContext>;
  readonly valueChange: OutputEmitterRef<FieldValue>;
}
export const FIELD_RENDERER_BINDINGS = { context: 'context', valueChange: 'valueChange' } as const;
