/** SPDX-License-Identifier: Apache-2.0 */
import { Component, input } from '@angular/core';
import type { FormDefinition, FormLayout, FormPresentation, FormPresentationContext, ValuePath } from '../../projects/ui-runtime/src/public-api.js';
import type { FormLayout as ProposedLayout, ValuePath as ProposedPath } from '../../docs/design/ui-runtime-v1.types.js';
@Component({ template: '<ng-content />' })
export class DefaultFrame implements FormPresentation { readonly context = input.required<FormPresentationContext>(); }
@Component({ template: '<aside><ng-content /></aside>' })
export class AlternateFrame implements FormPresentation { readonly context = input.required<FormPresentationContext>(); }
@Component({ template: '<ng-content select=".private" />' })
export class InvalidFrame implements FormPresentation { readonly context = input.required<FormPresentationContext>(); }
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
