import type { EditingInput } from '../state/document-state.js';
import type { ChoiceSelectorOptions } from '../selector/choice-options.js';
/**
 * SPDX-License-Identifier: Apache-2.0
 * Modified for AUR; see NOTICE for provenance and changes.
 */
import type { ControlRequest } from '../theme/optional-controls.js';
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
    /** Opt-in neutral paged selector; not an optional-control domain or a loader. */
    readonly selector?: ChoiceSelectorOptions;
    /** Optional instance domain/presentation used by an opt-in control host. */
    readonly control?: ControlRequest;
    /** Application-owned accessible feedback IDs; no validation semantics. */
    readonly describedBy?: readonly string[];
    /** Opt-in lossless document editing; value is only a legacy display projection. */
    readonly documentInput?: EditingInput;
    readonly invalid?: boolean;
    /** Host-rendered accessible messages; validation remains outside the renderer. */
    readonly feedback?: readonly string[];
}
export interface FieldRenderer {
    readonly context: InputSignal<FieldRendererContext>;
    readonly valueChange: OutputEmitterRef<FieldValue>;
}
export const FIELD_RENDERER_BINDINGS = { context: 'context', valueChange: 'valueChange' } as const;
