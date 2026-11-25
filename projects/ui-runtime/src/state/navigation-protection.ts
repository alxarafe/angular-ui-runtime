/** SPDX-License-Identifier: Apache-2.0 */
import { DocumentSession, type ConfirmDiscard } from './document-session.js';

/** Application guard adapters must await this boundary before performing their action. */
export class NavigationProtection {
    constructor(
        readonly session: DocumentSession,
        private readonly confirm: ConfirmDiscard,
    ) {}
    async requestLeave(reason: string): Promise<boolean> {
        return (await this.session.requestDiscard(reason, this.confirm)) === 'allowed';
    }
}

/** Minimal browser port; omitted targets support SSR without accessing global Window. */
export interface BeforeUnloadTarget {
    addEventListener(type: 'beforeunload', listener: (event: BeforeUnloadEvent) => void): void;
    removeEventListener(type: 'beforeunload', listener: (event: BeforeUnloadEvent) => void): void;
}
/** Explicit owner-scoped integration. Call the returned cleanup on owner destruction. */
export function protectBeforeUnload(
    session: DocumentSession,
    target?: BeforeUnloadTarget,
): () => void {
    if (!target) return () => {};
    let registered = false;
    const listener = (event: BeforeUnloadEvent): void => {
        if (!session.requiresProtection) return;
        event.preventDefault();
        event.returnValue = '';
    };
    const sync = (): void => {
        if (registered === session.requiresProtection) return;
        registered = session.requiresProtection;
        if (registered) target.addEventListener('beforeunload', listener);
        else target.removeEventListener('beforeunload', listener);
    };
    const unsubscribe = session.subscribe(sync);
    sync();
    return () => {
        unsubscribe();
        if (registered) target.removeEventListener('beforeunload', listener);
        registered = false;
    };
}
