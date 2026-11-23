/** SPDX-License-Identifier: Apache-2.0 */
import { Component, input } from '@angular/core';
import type { FormPresentation, FormPresentationContext } from './form-definition.js';
@Component({
    selector: 'aur-default-form-presentation',
    template: '<div class="aur-form-surface"><ng-content /></div>',
    styles: [
        ':host { display: block; min-width: 0; } .aur-form-surface { padding: 1rem; border: 1px solid currentColor; border-radius: .25rem; }',
    ],
})
export class DefaultFormPresentation implements FormPresentation {
    readonly context = input.required<FormPresentationContext>();
}
