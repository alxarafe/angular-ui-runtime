import { bootstrapApplication } from '@angular/platform-browser';
import { provideThemeRuntime } from '@alxarafe/ui-runtime';
import { NavigationTestbed } from './navigation';
import { DefaultThemeTestbed, DEFAULT_PACKAGE_THEMES } from './default-theme';

bootstrapApplication(new URLSearchParams(location.search).get('scenario') === 'navigation' ? NavigationTestbed : DefaultThemeTestbed, { providers: provideThemeRuntime(DEFAULT_PACKAGE_THEMES) })
  .catch(error => { console.error(error); throw error; });
