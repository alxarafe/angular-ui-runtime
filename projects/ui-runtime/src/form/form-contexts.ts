/** SPDX-License-Identifier: Apache-2.0 */
import type { FormDefinition, FormFieldContexts } from './form-definition.js';
/** Binding admission only; semantic validation remains a separate future boundary. */
export function validateFormContexts(definition: FormDefinition, contexts: FormFieldContexts): void {
  const ids = new Set<string>();
  for (const field of definition.fields) {
    if (field.excluded) continue;
    const context = Object.hasOwn(contexts, field.id) ? contexts[field.id] : undefined;
    if (!context || typeof context.id !== 'string' || !context.id.trim() ||
        typeof context.label !== 'string' || !context.label.trim() || ids.has(context.id))
      throw new Error('Missing, invalid or duplicate field renderer context');
    if (context.value !== null && typeof context.value !== 'string' && typeof context.value !== 'boolean')
      throw new Error('Invalid exact field renderer value');
    if ([context.disabled, context.readOnly].some(flag => flag !== undefined && typeof flag !== 'boolean'))
      throw new Error('Invalid field edit flag');
    ids.add(context.id);
  }
}
