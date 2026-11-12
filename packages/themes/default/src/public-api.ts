/** SPDX-License-Identifier: Apache-2.0; adapted from ERBAS artifact mapping; see NOTICE. */
import { ThemeArtifact, ThemeId, type ThemeArtifacts, type ThemeDefinition } from '@alxarafe/ui-runtime';
import { DefaultShell, DefaultNavigation, DefaultPanel } from './structure.js';
import {
  DefaultBooleanRenderer, DefaultStringRenderer, DefaultTextRenderer, DefaultNumberRenderer,
  DefaultDateRenderer, DefaultTimeRenderer, DefaultEnumRenderer, DefaultBinaryRenderer,
} from './fields.js';

export { DefaultShell, DefaultNavigation, DefaultPanel };
export {
  DefaultBooleanRenderer, DefaultStringRenderer, DefaultTextRenderer, DefaultNumberRenderer,
  DefaultDateRenderer, DefaultTimeRenderer, DefaultEnumRenderer, DefaultBinaryRenderer,
};

export const DEFAULT_ARTIFACTS = Object.freeze({
  [ThemeArtifact.Shell]: DefaultShell,
  [ThemeArtifact.Navigation]: DefaultNavigation,
  [ThemeArtifact.Panel]: DefaultPanel,
  [ThemeArtifact.FieldBoolean]: DefaultBooleanRenderer,
  [ThemeArtifact.FieldString]: DefaultStringRenderer,
  [ThemeArtifact.FieldText]: DefaultTextRenderer,
  [ThemeArtifact.FieldInt8]: DefaultNumberRenderer,
  [ThemeArtifact.FieldUint8]: DefaultNumberRenderer,
  [ThemeArtifact.FieldInt16]: DefaultNumberRenderer,
  [ThemeArtifact.FieldUint16]: DefaultNumberRenderer,
  [ThemeArtifact.FieldInt32]: DefaultNumberRenderer,
  [ThemeArtifact.FieldUint32]: DefaultNumberRenderer,
  [ThemeArtifact.FieldInt64]: DefaultNumberRenderer,
  [ThemeArtifact.FieldDecimal]: DefaultNumberRenderer,
  [ThemeArtifact.FieldUuid]: DefaultStringRenderer,
  [ThemeArtifact.FieldDate]: DefaultDateRenderer,
  [ThemeArtifact.FieldTime]: DefaultTimeRenderer,
  [ThemeArtifact.FieldDatetime]: DefaultStringRenderer,
  [ThemeArtifact.FieldEnum]: DefaultEnumRenderer,
  [ThemeArtifact.FieldBinary]: DefaultBinaryRenderer,
} satisfies ThemeArtifacts);

export const DEFAULT_THEME: ThemeDefinition = Object.freeze({
  id: ThemeId.Default, cssClass: 'theme-default', overrides: DEFAULT_ARTIFACTS,
});
