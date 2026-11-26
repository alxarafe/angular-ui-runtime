import { Component } from '@angular/core';
import {
    FormComposition,
    FormSlot,
    type FormSlotContext,
    type FormSlotReference,
    type FormDefinition,
} from '../../projects/ui-runtime/src/public-api.js';
@Component({
    imports: [FormComposition, FormSlot],
    template: `<aur-form [definition]="definition" [contexts]="{}"
        ><ng-template aurFormSlot="custom" let-readOnly="readOnly"
            ><button [disabled]="readOnly">Custom</button></ng-template
        ></aur-form
    >`,
})
export class SlotConsumer {
    readonly definition: FormDefinition = { id: 'slots', label: 'Slots', fields: [] };
}
const reference: FormSlotReference = { id: 'custom' };
const context: FormSlotContext = { readOnly: true };
// @ts-expect-error Executable templates are not layout metadata.
const unsupported: FormSlotReference = { id: 'custom', template: '<script />' };
// @ts-expect-error Slot identities are strings.
const wrong: FormSlotReference = { id: 1 };
void [reference, context, unsupported, wrong];
