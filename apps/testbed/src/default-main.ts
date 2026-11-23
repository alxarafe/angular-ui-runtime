import { FormTestbed, FORM_THEMES, FORM_CONTROLS } from './form';
import { GridTestbed, GRID_THEMES } from './grid';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideThemeRuntime } from '@alxarafe/ui-runtime';
import { NavigationTestbed } from './navigation';
import { DefaultThemeTestbed, DEFAULT_PACKAGE_THEMES } from './default-theme';

const form = new URLSearchParams(location.search).get('scenario') === 'form';
const grid = new URLSearchParams(location.search).get('scenario') === 'grid';
bootstrapApplication(
    grid
        ? GridTestbed
        : form
          ? FormTestbed
          : new URLSearchParams(location.search).get('scenario') === 'navigation'
            ? NavigationTestbed
            : DefaultThemeTestbed,
    {
        providers: provideThemeRuntime(
            grid ? GRID_THEMES : form ? FORM_THEMES : DEFAULT_PACKAGE_THEMES,
            grid || form ? FORM_CONTROLS : [],
        ),
    },
).catch((error) => {
    console.error(error);
    throw error;
});
