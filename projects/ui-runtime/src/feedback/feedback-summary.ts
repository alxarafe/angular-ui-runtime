/** SPDX-License-Identifier: Apache-2.0 */
import { Component, DestroyRef, ElementRef, computed, inject, input, signal } from '@angular/core';
import type { EditorFeedback } from '../editor/document-bindings.js';
import type { ValuePath } from '../form/form-definition.js';
import { formPathKey } from '../form/value-path.js';

/** True means focus was actually placed, not merely that a path was recognized. */
export type FeedbackReveal = (path: ValuePath) => boolean | Promise<boolean>;

/** Presentation and explicit focus interaction only; never edits or validates a document. */
@Component({
    selector: 'aur-feedback-summary',
    host: {
        role: 'region',
        tabindex: '-1',
        '[attr.aria-label]': 'label()',
        '[attr.aria-busy]': 'busy()',
    },
    template: `<h2>{{ label() }}</h2>
        <section aria-label="Errors">
            <h3>Errors ({{ errors().length }})</h3>
            @if (reveal() && errors().length) {
                <button
                    type="button"
                    [disabled]="!hasErrorPath()"
                    [attr.aria-disabled]="busy() || !hasErrorPath()"
                    (click)="focusFirstInvalid()"
                >
                    Focus first error
                </button>
            }
            <ul>
                @for (item of errors(); track $index) {
                    <li>
                        @if (reveal() && item.path.length) {
                            <button
                                type="button"
                                [attr.aria-disabled]="busy()"
                                (click)="focusFeedback(item)"
                            >
                                {{ text(item) }}
                            </button>
                        } @else {
                            <span>{{ text(item) }}</span>
                        }
                    </li>
                }
            </ul>
            @if (!errors().length) {
                <p>No errors.</p>
            }
        </section>
        <section aria-label="Deferred checks">
            <h3>Deferred checks ({{ deferred().length }})</h3>
            <ul>
                @for (item of deferred(); track $index) {
                    <li>
                        @if (reveal() && item.path.length) {
                            <button
                                type="button"
                                [attr.aria-disabled]="busy()"
                                (click)="focusFeedback(item)"
                            >
                                {{ text(item) }}
                            </button>
                        } @else {
                            <span>{{ text(item) }}</span>
                        }
                    </li>
                }
            </ul>
            @if (!deferred().length) {
                <p>No deferred checks.</p>
            }
        </section>
        <p role="status" aria-atomic="true">{{ status() }}</p>`,
    styles: [
        `
            :host {
                display: block;
                min-width: 0;
                padding: 0.75rem;
                border: 1px solid currentColor;
                overflow-wrap: anywhere;
            }
            button {
                font: inherit;
                color: inherit;
                background: transparent;
                border: 1px solid currentColor;
                max-width: 100%;
                white-space: normal;
                text-align: start;
                padding: 0.5rem;
                cursor: pointer;
            }
            li {
                margin-block: 0.25rem;
            }
            ul {
                padding-inline-start: 1.5rem;
            }
            :host:focus-visible,
            button:focus-visible {
                outline: 3px solid currentColor;
                outline-offset: 2px;
            }
            button[aria-disabled='true'] {
                cursor: wait;
            }
        `,
    ],
})
export class FeedbackSummary {
    readonly feedback = input.required<readonly EditorFeedback[]>();
    readonly label = input('Document feedback');
    /** Optional application labels; raw property names/row keys are never inferred for display. */
    readonly labelPath = input<(path: ValuePath) => string>((path) =>
        path.length ? '' : 'Document',
    );
    readonly reveal = input<FeedbackReveal>();
    protected readonly errors = computed(() =>
        this.feedback().filter((item) => item.source !== 'deferred'),
    );
    protected readonly deferred = computed(() =>
        this.feedback().filter((item) => item.source === 'deferred'),
    );
    protected readonly hasErrorPath = computed(() =>
        this.errors().some((item) => item.path.length),
    );
    protected readonly busy = signal(false);
    private readonly result = signal<
        { feedback: readonly EditorFeedback[]; message: string } | undefined
    >(undefined);
    protected readonly status = computed(() => {
        const result = this.result();
        return result?.feedback === this.feedback() ? result.message : '';
    });
    private readonly root = inject<ElementRef<HTMLElement>>(ElementRef);
    private readonly owner = inject(DestroyRef);
    protected text(item: EditorFeedback): string {
        const label = this.labelPath()(item.path);
        return `${item.source}: ${label ? label + ' — ' : ''}${item.message}`;
    }
    /** Explicit return target for application correction flows; never called on input refresh. */
    focus(): boolean {
        if (this.owner.destroyed) return false;
        const root = this.root.nativeElement;
        root.focus();
        return root.ownerDocument.activeElement === root;
    }
    focusFeedback(item: EditorFeedback): Promise<boolean> {
        return this.navigate([item]);
    }
    focusFirstInvalid(): Promise<boolean> {
        return this.navigate(this.errors());
    }
    private async navigate(items: readonly EditorFeedback[]): Promise<boolean> {
        const reveal = this.reveal();
        if (this.busy() || !reveal || this.owner.destroyed) return false;
        const feedback = this.feedback();
        const document = this.root.nativeElement.ownerDocument;
        const origin = document.activeElement;
        const seen = new Set<string>();
        this.busy.set(true);
        this.result.set(undefined);
        try {
            for (const item of items) {
                if (!item.path.length || !feedback.includes(item)) continue;
                const key = formPathKey(item.path);
                if (seen.has(key)) continue;
                seen.add(key);
                if (
                    this.owner.destroyed ||
                    this.feedback() !== feedback ||
                    this.reveal() !== reveal ||
                    (document.activeElement !== origin && document.activeElement !== document.body)
                )
                    return false;
                const focused = await reveal(item.path);
                if (
                    this.owner.destroyed ||
                    this.feedback() !== feedback ||
                    this.reveal() !== reveal
                )
                    return false;
                if (focused) return true;
                if (document.activeElement !== origin && document.activeElement !== document.body)
                    return false;
            }
            if (!this.owner.destroyed)
                this.result.set({ feedback, message: 'No focusable target for this feedback.' });
            return false;
        } catch {
            if (!this.owner.destroyed)
                this.result.set({ feedback, message: 'Feedback could not be revealed.' });
            return false;
        } finally {
            if (!this.owner.destroyed) this.busy.set(false);
        }
    }
}
