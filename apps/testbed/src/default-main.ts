import { FormTestbed, FORM_THEMES, FORM_CONTROLS } from './form';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideThemeRuntime } from '@alxarafe/ui-runtime';
import { NavigationTestbed } from './navigation';
import { DefaultThemeTestbed, DEFAULT_PACKAGE_THEMES } from './default-theme';

const form = new URLSearchParams(location.search).get('scenario') === 'form';
bootstrapApplication(form ? FormTestbed : new URLSearchParams(location.search).get('scenario') === 'navigation' ? NavigationTestbed : DefaultThemeTestbed, { providers: provideThemeRuntime(form ? FORM_THEMES : DEFAULT_PACKAGE_THEMES, form ? FORM_CONTROLS : []) })
  .catch(error => { console.error(error); throw error; });
