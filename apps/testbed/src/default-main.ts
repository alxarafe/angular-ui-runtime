import { DocumentProtectionTestbed } from './document-protection';
import { DocumentSaveTestbed } from './document-save';
import { StateTestbed } from './state';
import { ValidationTestbed } from './validation';
import { DocumentValidationTestbed } from './document-validation';
import { FormTestbed, FORM_THEMES, FORM_CONTROLS } from './form';
import { GridTestbed, GRID_THEMES } from './grid';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideThemeRuntime } from '@alxarafe/ui-runtime';
import { NavigationTestbed } from './navigation';
import { DefaultThemeTestbed, DEFAULT_PACKAGE_THEMES } from './default-theme';

const save = new URLSearchParams(location.search).get('scenario') === 'document-save';
const form = new URLSearchParams(location.search).get('scenario') === 'form';
const state = new URLSearchParams(location.search).get('scenario') === 'state';
const validation = new URLSearchParams(location.search).get('scenario') === 'validation';
const documentValidation =
    new URLSearchParams(location.search).get('scenario') === 'document-validation';
const grid = new URLSearchParams(location.search).get('scenario') === 'grid';
bootstrapApplication(
    new URLSearchParams(location.search).get('scenario') === 'document-protection'
        ? DocumentProtectionTestbed
        : save
          ? DocumentSaveTestbed
          : documentValidation
            ? DocumentValidationTestbed
            : validation
              ? ValidationTestbed
              : state
                ? StateTestbed
                : grid
                  ? GridTestbed
                  : form
                    ? FormTestbed
                    : new URLSearchParams(location.search).get('scenario') === 'navigation'
                      ? NavigationTestbed
                      : DefaultThemeTestbed,
    {
        providers: provideThemeRuntime(
            grid || state || validation || documentValidation || save
                ? GRID_THEMES
                : form
                  ? FORM_THEMES
                  : DEFAULT_PACKAGE_THEMES,
            grid || form || state || validation || documentValidation || save ? FORM_CONTROLS : [],
        ),
    },
).catch((error) => {
    console.error(error);
    throw error;
});
