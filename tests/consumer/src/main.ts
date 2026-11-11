import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { UI_RUNTIME_VERSION } from '@alxarafe/ui-runtime';

@Component({
  selector: 'aur-consumer',
  standalone: true,
  template: '<p>Runtime {{ version }}</p>',
})
class Consumer {
  readonly version = UI_RUNTIME_VERSION;
}

bootstrapApplication(Consumer).catch((error: unknown) => { throw error; });
