import { Component, OnDestroy, signal } from '@angular/core';
import {
    DocumentSession,
    createDocumentState,
    NavigationProtection,
    protectBeforeUnload,
    type DiscardRequest,
} from '@alxarafe/ui-runtime';

/** Synthetic application adapters; no Router or persistence contract is installed. */
@Component({
    selector: 'qa-testbed',
    standalone: true,
    template: `<h1>Document protection QA</h1>
        <input aria-label="Document draft" [value]="value()" (input)="edit($event)" />
        <button (click)="leave('route')">Route</button>
        <button (click)="leave('back')">Back</button>
        <button (click)="leave('programmatic')">Replace record</button>
        <button (click)="leave('discard')">Discard</button>
        <button (click)="cleanup()">Destroy lifecycle owner</button>
        @if (request()) {
            <section role="dialog" aria-label="Discard changes">
                <button (click)="answer(false)">Cancel</button
                ><button (click)="answer(true)">Confirm</button>
            </section>
        }
        <output data-testid="decision">{{ decision() }}</output>
        <output data-testid="prompts">{{ prompts() }}</output>
        <output data-testid="dirty">{{ session.state.dirty }}</output>
        <output data-testid="unload">{{ unloadRegistered() }}</output>`,
})
export class DocumentProtectionTestbed implements OnDestroy {
    readonly session = new DocumentSession(
        createDocumentState({
            kind: 'object',
            properties: {
                title: {
                    kind: 'field',
                    equality: { type: 'exact' },
                    input: { kind: 'value', value: 'Accepted' },
                },
            },
        }),
    );
    readonly value = signal('Accepted');
    readonly request = signal<DiscardRequest | undefined>(undefined);
    readonly decision = signal('');
    readonly prompts = signal(0);
    readonly unloadRegistered = signal(false);
    private resolve?: (confirmed: boolean) => void;
    private focused?: HTMLElement;
    readonly navigation = new NavigationProtection(this.session, (request) => {
        this.prompts.update((n) => n + 1);
        this.request.set(request);
        return new Promise<boolean>((resolve) => {
            this.resolve = resolve;
        });
    });
    readonly cleanup = protectBeforeUnload(this.session, {
        addEventListener: (type, listener) => {
            window.addEventListener(type, listener);
            this.unloadRegistered.set(true);
        },
        removeEventListener: (type, listener) => {
            window.removeEventListener(type, listener);
            this.unloadRegistered.set(false);
        },
    });
    edit(event: Event): void {
        const value = (event.target as HTMLInputElement).value;
        this.session.change({
            kind: 'field',
            path: [{ kind: 'property', name: 'title' }],
            input: { kind: 'raw', text: value },
        });
        this.value.set(value);
    }
    async leave(reason: string): Promise<void> {
        // Real route/popstate adapters must defer or restore navigation themselves.
        if (!this.request()) this.focused = document.activeElement as HTMLElement;
        const allowed = await this.navigation.requestLeave(reason);
        this.decision.set(allowed ? reason + ':allowed' : reason + ':denied');
        if (allowed) {
            const field = this.session.state.current.properties['title'];
            if (field?.kind === 'field' && field.input.kind === 'value')
                this.value.set(String(field.input.value));
        }
    }
    answer(confirmed: boolean): void {
        this.resolve?.(confirmed);
        this.resolve = undefined;
        this.request.set(undefined);
        this.focused?.focus();
    }
    ngOnDestroy(): void {
        this.answer(false);
        this.cleanup();
    }
}
