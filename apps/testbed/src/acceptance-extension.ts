/** Application-owned synthetic content: independent local draft, no automatic session binding. */
import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
@Component({
    selector: 'qa-acceptance-extension',
    host: { '[attr.data-instance]': 'instance' },
    template: `<label
        >Extension draft<input
            [value]="draft()"
            [readOnly]="readOnly()"
            [disabled]="disabled()"
            (input)="edit($any($event.target).value)"
    /></label>`,
    styles: [
        ':host{display:block;min-width:0}label{display:block}input{font:inherit;max-width:100%;box-sizing:border-box}',
    ],
})
export class AcceptanceExtension {
    static created = 0;
    static destroyed = 0;
    readonly instance = ++AcceptanceExtension.created;
    readonly draft = signal('Application extension');
    readonly readOnly = input(false);
    readonly disabled = input(false);
    readonly changed = output<string>();
    constructor() {
        inject(DestroyRef).onDestroy(() => AcceptanceExtension.destroyed++);
    }
    edit(value: string): void {
        if (this.readOnly() || this.disabled()) return;
        this.draft.set(value);
        this.changed.emit(value);
    }
}
