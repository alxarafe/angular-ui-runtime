/** SPDX-License-Identifier: Apache-2.0 */
import {
    DocumentSession,
    createDocumentState,
    type DocumentObject,
    type ObjectValidationPlan,
    type DocumentSaveOutcome,
    type DocumentSaveIssue,
} from '../../projects/ui-runtime/src/public-api.js';

const document: DocumentObject = { kind: 'object', properties: {} };
const plan: ObjectValidationPlan = { kind: 'object', properties: {} };
const session = new DocumentSession(createDocumentState(document));
const result = session.submit(plan);
if (result.kind === 'ready') {
    session.resolve(result.submission, { kind: 'committed' });
    session.recover(result.submission, document, true);
    // @ts-expect-error A submission revision is immutable, not a server version.
    result.submission.revision = 2;
    // @ts-expect-error A snapshot cannot be edited in place.
    result.submission.document.properties['extra'] = document;
}
// @ts-expect-error Acceptance requires a complete authoritative document.
const incomplete: DocumentSaveOutcome = { kind: 'accepted' };
// @ts-expect-error Unknown business/transport outcomes are not library state transitions.
const business: DocumentSaveOutcome = { kind: 'invoice-posted' };
// @ts-expect-error Save feedback uses typed paths, not string paths.
const feedback: DocumentSaveIssue = { code: 'adapter', message: 'Rejected', path: 'rows.0' };
// @ts-expect-error Session state cannot be replaced with an unlocked snapshot.
session.state = createDocumentState(document);
void [incomplete, business, feedback];
