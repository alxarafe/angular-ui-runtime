import {
    DocumentSession,
    NavigationProtection,
    protectBeforeUnload,
    type ConfirmDiscard,
    type DiscardResult,
} from '../../projects/ui-runtime/src/public-api.js';

function protectionApi(session: DocumentSession, browserWindow: Window): void {
    const confirm: ConfirmDiscard = async (request) => {
        const revision: number = request.revision;
        const reason: string = request.reason;
        // @ts-expect-error Captured requests cannot be mutated by dialogs.
        request.revision = revision + 1;
        return reason.length > 0;
    };
    const result: Promise<DiscardResult> = session.requestDiscard('discard', confirm);
    const allowed: Promise<boolean> = new NavigationProtection(session, confirm).requestLeave(
        'route',
    );
    const cleanup: () => void = protectBeforeUnload(session, browserWindow);
    const ssrCleanup: () => void = protectBeforeUnload(session);
    // @ts-expect-error The confirmation boundary must be asynchronous.
    session.requestDiscard('discard', () => true);
    void [result, allowed, cleanup, ssrCleanup];
}
void protectionApi;
