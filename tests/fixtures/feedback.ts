import { Component, viewChild } from '@angular/core';
import {
    FeedbackSummary,
    FormComposition,
    type EditorFeedback,
    type FeedbackReveal,
    type FormDefinition,
} from '../../projects/ui-runtime/src/public-api.js';
@Component({
    imports: [FeedbackSummary, FormComposition],
    template: `<aur-feedback-summary [feedback]="feedback" [reveal]="reveal" /><aur-form
            [definition]="definition"
            [contexts]="{}"
        />`,
})
export class FeedbackConsumer {
    readonly form = viewChild(FormComposition);
    readonly definition: FormDefinition = { id: 'qa', label: 'QA', fields: [] };
    readonly feedback: readonly EditorFeedback[] = [
        { source: 'server', path: [], message: 'Root' },
    ];
    readonly reveal: FeedbackReveal = (path) =>
        new Promise((resolve) => {
            const form = this.form();
            if (form) form.revealPath(path, resolve);
            else resolve(false);
        });
}
// @ts-expect-error A reveal port must report success, not mutate document state without a result.
const bad: FeedbackReveal = () => {};
const wrong: EditorFeedback = {
    source: 'local',
    // @ts-expect-error Existing typed paths never accept positional rows.
    path: [{ kind: 'row', index: 0 }],
    message: 'Wrong',
};
void [bad, wrong];
