/** SPDX-License-Identifier: Apache-2.0 */
import type {
    DetailGridContext,
    DetailGridChange,
    FieldValue,
    FormDefinition,
    ThemeComponents,
} from '../../projects/ui-runtime/src/public-api.js';
import { DefaultFrame } from './form-components.js';
const legacyComponents: ThemeComponents = { form: DefaultFrame };
void legacyComponents;
function contract(context: DetailGridContext, change: DetailGridChange): void {
    const form: FormDefinition = {
        id: 'parent',
        label: 'Parent',
        fields: [],
        collections: [{ id: context.id, path: context.path }],
    };
    // @ts-expect-error Numeric coercion is outside the exact transport contract.
    const numeric: FieldValue = 9007199254740992;
    const add: DetailGridChange = {
        kind: 'add-row',
        collectionId: context.id,
        collectionPath: context.path,
        // @ts-expect-error Add requests do not create application-owned rows.
        row: { key: 'invented' },
    };
    // @ts-expect-error Every collection intent identifies the collection.
    const anonymous: DetailGridChange = { kind: 'remove-row', key: 'a' };
    if (change.kind === 'cell') {
        const value: FieldValue = change.value;
        void value;
    }
    void [form, numeric, add, anonymous];
}
void contract;
