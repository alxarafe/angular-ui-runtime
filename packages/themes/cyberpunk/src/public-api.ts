/** SPDX-License-Identifier: Apache-2.0; adapted from ERBAS; see NOTICE. */
import { Component, input, output } from '@angular/core';
import {
  ThemeArtifact, ThemeNavigationOutlet, ThemePanelOutlet, type ThemeDefinition,
  type ThemeShellComponent, type ThemeNavigationItem, type ThemeNavigationSelection,
} from '@alxarafe/ui-runtime';

@Component({ selector: 'aur-cyberpunk-panel', template: '<div class="aur-cyberpunk-panel"><div class="aur-cyberpunk-panel-content"><ng-content /></div></div>' })
export class CyberpunkPanel {}

@Component({ selector: 'aur-cyberpunk-shell', imports: [ThemeNavigationOutlet, ThemePanelOutlet], templateUrl: './shell.html' })
export class CyberpunkShell implements ThemeShellComponent {
  readonly navigation = input<readonly ThemeNavigationItem[]>([]);
  readonly navigationSelected = output<ThemeNavigationSelection>();
}

export const CYBERPUNK_THEME: ThemeDefinition = Object.freeze({
  id: 'cyberpunk', cssClass: 'theme-cyberpunk',
  overrides: Object.freeze({ [ThemeArtifact.Shell]: CyberpunkShell, [ThemeArtifact.Panel]: CyberpunkPanel }),
});
