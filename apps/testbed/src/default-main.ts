import { bootstrapApplication } from '@angular/platform-browser';
import { provideThemeRuntime } from '@alxarafe/ui-runtime';
import { DefaultThemeTestbed, DEFAULT_PACKAGE_THEMES } from './default-theme';

bootstrapApplication(DefaultThemeTestbed, { providers: provideThemeRuntime(DEFAULT_PACKAGE_THEMES) })
  .catch(error => { console.error(error); throw error; });
