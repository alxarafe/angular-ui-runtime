/** SPDX-License-Identifier: Apache-2.0; adapted from ERBAS; see NOTICE. */
import { Component } from '@angular/core';
import { ThemeArtifact, type ThemeDefinition } from '@alxarafe/ui-runtime';

@Component({ selector: 'aur-high-contrast-panel', template: '<div class="aur-high-contrast-panel"><div class="aur-high-contrast-content"><ng-content /></div></div>' })
export class HighContrastPanel {}

export const HIGH_CONTRAST_THEME: ThemeDefinition = Object.freeze({
  id: 'high-contrast', cssClass: 'theme-high-contrast',
  overrides: Object.freeze({ [ThemeArtifact.Panel]: HighContrastPanel }),
});
