import { InputSignal, OutputEmitterRef, TemplateRef } from '@angular/core';

/** A single application-owned navigation tree, not the proposed 1.0 menu model. */
export interface ThemeNavigationItem {
  readonly id: string;
  readonly label: string;
  readonly href?: string;
  readonly disabled?: boolean;
  readonly current?: boolean;
  readonly children?: readonly ThemeNavigationItem[];
}

/** Intent only: the application resolves the identity and performs the operation. */
export interface ThemeNavigationSelection {
  readonly itemId: string;
}

export const THEME_SHELL_BINDINGS = Object.freeze({
  navigation: 'navigation',
  navigationSelected: 'navigationSelected',
} as const);
export const THEME_NAVIGATION_BINDINGS = Object.freeze({ items: 'items', selected: 'selected' } as const);
export const THEME_SHELL_PROJECTION = Object.freeze({
  heading: '[aur-shell-heading]',
  content: '[aur-shell-content]',
  footer: '[aur-shell-footer]',
} as const);
export const THEME_REGION_ATTRIBUTE = 'aur-theme-region';

/** Templates remain owned by the application host; names are local presentation IDs. */
export type ThemeRegions = Readonly<Record<string, TemplateRef<unknown>>>;

export interface ThemeShellComponent {
  readonly navigation: InputSignal<readonly ThemeNavigationItem[]>;
  readonly navigationSelected: OutputEmitterRef<ThemeNavigationSelection>;
}

export interface ThemeNavigationComponent {
  readonly items: InputSignal<readonly ThemeNavigationItem[]>;
  readonly selected: OutputEmitterRef<ThemeNavigationSelection>;
}

// Panel's port is ordinary Angular <ng-content />; no empty marker interface is needed.
