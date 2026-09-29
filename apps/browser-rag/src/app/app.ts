import { Component } from '@angular/core';
import { ManualAssistant } from './domains/manual/feat-manual/manual-assistant';
@Component({
  selector: 'app-root',
  imports: [ManualAssistant],
  template: `<app-manual-assistant />`,
})
export class App {}
